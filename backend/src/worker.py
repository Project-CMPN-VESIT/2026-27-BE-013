import asyncio
import time
from datetime import datetime, timezone
import json
import os
import sys
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import AsyncSessionLocal
from models_db import (
    Investigation, InvestigationJob, Document, Source,
    ProvenanceRecord, NarrativeEvolution, SentimentRecord,
    Claim, ClaimCluster, EvidenceRecord, SourceDivergenceRecord, IntelligenceDecomposition
)
from adapters import ALL_DISCOVERY_ADAPTERS
from dedup import canonicalize_url, compute_content_hash, extract_domain
from date_utils import filter_by_year_range
from acquirer import fetch_article_html
from extractor import extract_article_content
from embeddings import compute_embeddings
from shift import compute_shift
from sentiment import compute_sentiment
from narrative import generate_narrative
from sampling import balance_temporal_samples
from claims import extract_claims_from_documents
from clustering import cluster_claims
from evolution import analyze_narrative_evolution
from evidence import extract_evidence_spans
from divergence import compute_source_divergence
from decomposition import decompose_narrative_shift
from perspectives import classify_perspective, compute_perspective_analysis


def utc_now():
    return datetime.now(timezone.utc)


# 17 Explicit Named Job States
EXPLICIT_JOB_STATES = [
    "QUEUED", "DISCOVERING", "ACQUIRING", "EXTRACTING", "DEDUPLICATING",
    "EMBEDDING", "SENTIMENT", "CLAIMS", "CLUSTERING", "NARRATIVE_EVOLUTION",
    "EVIDENCE", "PROVENANCE", "INTELLIGENCE", "AI", "COMPLETED", "PARTIAL", "FAILED"
]


async def run_investigation_job(job_id: str):
    print(f"[Worker] Starting background task for job: {job_id}")
    async with AsyncSessionLocal() as db:
        stmt = select(InvestigationJob).where(InvestigationJob.id == job_id).with_for_update(skip_locked=True)
        res = await db.execute(stmt)
        job = res.scalars().first()

        if not job:
            print(f"[Worker] Job {job_id} NOT FOUND or LOCKED (skipped).")
            return
        
        if job.job_status in ("COMPLETED", "FAILED"):
            print(f"[Worker] Job {job_id} already finished.")
            return

        investigation_id = job.investigation_id
        inv_stmt = select(Investigation).where(Investigation.id == investigation_id)
        inv_res = await db.execute(inv_stmt)
        investigation = inv_res.scalars().first()

        if not investigation:
            job.job_status = "FAILED"
            job.error_message = "Associated investigation record not found"
            await db.commit()
            return

        start_time = time.time()
        job.job_status = "DISCOVERING"
        job.stage = "discovering"
        job.progress = 5.0
        investigation.status = "running"
        await db.commit()

        topic_key = investigation.topic
        query = investigation.search_query or topic_key
        start_year = investigation.start_year
        end_year = investigation.end_year

        timings = {}
        counts = {}

        try:
            # ── 1. DISCOVERING ──────────────────────────────────────────────
            t0 = time.time()
            adapter_tasks = [adapter.discover(query, start_year, end_year) for adapter in ALL_DISCOVERY_ADAPTERS]
            adapter_results = await asyncio.gather(*adapter_tasks, return_exceptions=True)

            raw_candidates = []
            source_breakdown = {}
            for adapter, result in zip(ALL_DISCOVERY_ADAPTERS, adapter_results):
                if isinstance(result, list):
                    raw_candidates.extend(result)
                    source_breakdown[adapter.name] = len(result)
                else:
                    source_breakdown[adapter.name] = 0

            timings["discovery_sec"] = round(time.time() - t0, 3)
            counts["discovered"] = len(raw_candidates)

            # ── 2. ACQUIRING ────────────────────────────────────────────────
            job.progress = 15.0
            job.job_status = "ACQUIRING"
            job.stage = "acquiring"
            await db.commit()

            # Deduplicate and balance candidates across adapters for true multi-source coverage
            seen_urls = set()
            by_adapter = {}
            for cand in raw_candidates:
                clean_url = canonicalize_url(cand.canonical_url)
                if clean_url and clean_url not in seen_urls:
                    seen_urls.add(clean_url)
                    method = cand.discovery_method or "unknown"
                    by_adapter.setdefault(method, []).append(cand)

            # Round-robin selection across adapters up to 120 candidates
            dedup_candidates = []
            while any(by_adapter.values()) and len(dedup_candidates) < 120:
                for method in list(by_adapter.keys()):
                    if by_adapter[method]:
                        dedup_candidates.append(by_adapter[method].pop(0))

            semaphore = asyncio.Semaphore(10)
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                fetch_tasks = [fetch_article_html(cand.canonical_url, client, semaphore) for cand in dedup_candidates[:100]]
                fetch_results = await asyncio.gather(*fetch_tasks, return_exceptions=True)

            url_to_html = {}
            for res in fetch_results:
                if isinstance(res, tuple) and len(res) == 3:
                    u, html_str, http_st = res
                    url_to_html[u] = (html_str, http_st)

            counts["acquired"] = len(url_to_html)

            # ── 3. EXTRACTING ───────────────────────────────────────────────
            job.progress = 25.0
            job.job_status = "EXTRACTING"
            job.stage = "extracting"
            await db.commit()

            extracted_articles = []
            per_year_counts = {y: 0 for y in range(start_year, end_year + 1)}

            for cand in dedup_candidates:
                url = cand.canonical_url
                html_str, http_st = url_to_html.get(url, ("", 500))

                extracted = extract_article_content(html_str, url)
                title = extracted.get("title") or cand.title or "Untitled Report"
                extracted_text = extracted.get("text") or ""
                
                # If full HTML extraction produced substantial text, use it; otherwise fallback to title + description
                if len(extracted_text.split()) >= 15:
                    text = extracted_text
                    usable = True
                else:
                    desc = cand.description or ""
                    text = f"{title}. {desc}".strip()
                    usable = len(text.split()) >= 4

                pub_date = extracted.get("pub_date") or cand.pub_date
                year = cand.published_year or start_year

                if usable and len(text.split()) >= 4:
                    cand_pers = cand.perspective if hasattr(cand, "perspective") and cand.perspective else None
                    pers = cand_pers or classify_perspective(cand.canonical_url, cand.source_name)
                    extracted_articles.append({
                        "candidate": cand,
                        "title": title,
                        "text": text,
                        "pub_date": pub_date,
                        "year": year,
                        "http_status": http_st,
                        "content_hash": compute_content_hash(title + text[:200]),
                        "canonical_url": cand.canonical_url,
                        "source_name": cand.source_name or extract_domain(cand.canonical_url),
                        "perspective": pers,
                    })
                    if year in per_year_counts:
                        per_year_counts[year] += 1

            counts["extracted"] = len(extracted_articles)

            # ── 4. DEDUPLICATING & TEMPORAL BALANCING ────────────────────────
            job.progress = 35.0
            job.job_status = "DEDUPLICATING"
            job.stage = "deduplicating"
            await db.commit()

            sampling_res = balance_temporal_samples(extracted_articles, start_year, end_year, max_per_year=50, seed=42)
            usable_articles = sampling_res["selected_articles"]
            counts["usable"] = len(usable_articles)

            # ── 5. PROVENANCE & DOCUMENT PERSISTENCE ────────────────────────
            job.progress = 45.0
            job.job_status = "PROVENANCE"
            job.stage = "provenance"
            await db.commit()

            db_docs = []
            for item in usable_articles:
                cand = item["candidate"]
                domain_name = cand.domain or extract_domain(cand.canonical_url)

                src_stmt = select(Source).where(Source.canonical_domain == domain_name)
                src_res = await db.execute(src_stmt)
                src = src_res.scalars().first()
                if not src:
                    src = Source(
                        canonical_domain=domain_name,
                        source_name=cand.source_name or domain_name,
                        source_type=cand.source_type,
                        political_perspective=item["perspective"],
                    )
                    db.add(src)
                    await db.flush()

                doc = Document(
                    investigation_id=investigation_id,
                    source_id=src.id,
                    canonical_url=cand.canonical_url,
                    content_hash=item["content_hash"],
                    title=item["title"],
                    author=cand.author or None,
                    publication_date=item["pub_date"],
                    published_year=item["year"],
                    cleaned_content=item["text"][:2500],
                    extraction_status="extracted",
                )
                db.add(doc)
                await db.flush()
                item["db_id"] = doc.id
                db_docs.append(doc)

                prov = ProvenanceRecord(
                    document_id=doc.id,
                    fetch_method=cand.discovery_method,
                    http_status=item["http_status"],
                    checksum=item["content_hash"],
                    pipeline_version="3.0.0",
                )
                db.add(prov)

            await db.commit()

            # ── 6. EMBEDDING & SEMANTIC SHIFT ────────────────────────────────
            t_emb = time.time()
            job.progress = 55.0
            job.job_status = "EMBEDDING"
            job.stage = "embedding"
            await db.commit()

            slug = topic_key.replace(" ", "_")
            os.makedirs("data/processed", exist_ok=True)
            csv_path = f"data/processed/{slug}_clean.csv"

            import pandas as pd
            df_rows = [
                {
                    "text": item["title"] + " " + item["text"],
                    "year": item["year"],
                    "source": item["source_name"],
                    "perspective": item["perspective"],
                    "url": item["canonical_url"],
                }
                for item in usable_articles
            ]

            if df_rows:
                pd.DataFrame(df_rows).to_csv(csv_path, index=False, encoding="utf-8")
                embeddings, meta = compute_embeddings(topic_key)
                shifts = compute_shift(topic_key, start_year, end_year)
            else:
                shifts = {"years": list(range(start_year, end_year + 1)), "shifts": {}}

            timings["embeddings_sec"] = round(time.time() - t_emb, 3)

            # ── 7. SENTIMENT ────────────────────────────────────────────────
            t_sent = time.time()
            job.progress = 65.0
            job.job_status = "SENTIMENT"
            job.stage = "sentiment"
            await db.commit()

            if df_rows:
                sentiment = compute_sentiment(topic_key, start_year, end_year)
            else:
                sentiment = {}

            for yr_str, sent_data in sentiment.items():
                if isinstance(sent_data, dict):
                    sr = SentimentRecord(
                        investigation_id=investigation_id,
                        year=int(yr_str),
                        positive_pct=float(sent_data.get("positive", 0)),
                        negative_pct=float(sent_data.get("negative", 0)),
                        neutral_pct=float(sent_data.get("neutral", 0)),
                        total_articles=int(sent_data.get("total", 0)),
                    )
                    db.add(sr)
            await db.commit()
            timings["sentiment_sec"] = round(time.time() - t_sent, 3)

            # ── 8. CLAIMS ───────────────────────────────────────────────────
            t_claims = time.time()
            job.progress = 72.0
            job.job_status = "CLAIMS"
            job.stage = "claims"
            await db.commit()

            # Extract claims linked to db_docs
            doc_dicts = [{"id": d.id, "cleaned_content": d.cleaned_content, "source_name": item["source_name"], "pub_date": d.publication_date, "year": d.published_year, "perspective": item["perspective"]} for d, item in zip(db_docs, usable_articles)]
            extracted_claims = extract_claims_from_documents(doc_dicts)

            db_claims = []
            for c_item in extracted_claims:
                claim_row = Claim(
                    document_id=c_item["document_id"],
                    claim_text=c_item["claim_text"],
                    confidence_score=c_item["confidence_score"],
                    category=c_item["category"],
                    source_name=c_item["source_name"],
                    publication_date=c_item["publication_date"],
                )
                db.add(claim_row)
                await db.flush()
                c_item["id"] = claim_row.id
                db_claims.append(c_item)

            await db.commit()
            timings["claims_sec"] = round(time.time() - t_claims, 3)

            # ── 9. CLUSTERING ───────────────────────────────────────────────
            t_clust = time.time()
            job.progress = 78.0
            job.job_status = "CLUSTERING"
            job.stage = "clustering"
            await db.commit()

            clustering_res = cluster_claims(db_claims, threshold=0.70)
            clusters_list = clustering_res.get("clusters", [])

            for cl in clusters_list:
                cc = ClaimCluster(
                    investigation_id=investigation_id,
                    cluster_label=cl["cluster_label"],
                    description=cl["description"],
                    year=start_year, # Primary representative year
                    member_claims_count=cl["member_claims_count"],
                    unclustered_flag=cl["unclustered_flag"],
                    supporting_data=cl.get("year_breakdown"),
                )
                db.add(cc)
            await db.commit()
            timings["clustering_sec"] = round(time.time() - t_clust, 3)

            # ── 10. NARRATIVE_EVOLUTION ─────────────────────────────────────
            t_evol = time.time()
            job.progress = 83.0
            job.job_status = "NARRATIVE_EVOLUTION"
            job.stage = "narrative_evolution"
            await db.commit()

            evolutions = analyze_narrative_evolution(shifts, sentiment, clustering_res, start_year, end_year)
            for ev in evolutions:
                ne = NarrativeEvolution(
                    investigation_id=investigation_id,
                    year=ev["year"],
                    narrative_summary=ev["narrative_summary"],
                    shift_delta=ev["shift_delta"],
                    transition_type=ev["transition_type"],
                    supporting_data=ev["supporting_data"],
                )
                db.add(ne)
            await db.commit()
            timings["narrative_evolution_sec"] = round(time.time() - t_evol, 3)

            # ── 11. EVIDENCE ────────────────────────────────────────────────
            t_evid = time.time()
            job.progress = 88.0
            job.job_status = "EVIDENCE"
            job.stage = "evidence"
            await db.commit()

            evidence_spans = extract_evidence_spans(db_claims, doc_dicts)
            for ev_item in evidence_spans:
                er = EvidenceRecord(
                    claim_id=ev_item["claim_id"],
                    document_id=ev_item["document_id"],
                    quote=ev_item["quote"],
                    start_char=ev_item["start_char"],
                    end_char=ev_item["end_char"],
                    evidence_type=ev_item["evidence_type"],
                    extraction_method=ev_item["extraction_method"],
                    sentiment_label=ev_item["sentiment_label"],
                    perspective=ev_item["perspective"],
                )
                db.add(er)
            await db.commit()
            timings["evidence_sec"] = round(time.time() - t_evid, 3)

            # ── 12. INTELLIGENCE (DIVERGENCE & WHY DID IT SHIFT) ─────────────
            t_intel = time.time()
            job.progress = 92.0
            job.job_status = "INTELLIGENCE"
            job.stage = "intelligence"
            await db.commit()

            divergences = compute_source_divergence(usable_articles, start_year, end_year)
            for div in divergences:
                sdr = SourceDivergenceRecord(
                    investigation_id=investigation_id,
                    year=div["year"],
                    comparison_group=div["comparison_group"],
                    perspective=div["perspective"],
                    divergence_score=div["divergence_score"],
                    divergence_type=div["divergence_type"],
                    sample_size=div["sample_size"],
                    data_status=div["data_status"],
                    notes=div["notes"],
                    supporting_data=div.get("supporting_data"),
                )
                db.add(sdr)

            decompositions = decompose_narrative_shift(shifts, sentiment, clustering_res, usable_articles, start_year, end_year)
            for dec in decompositions:
                idec = IntelligenceDecomposition(
                    investigation_id=investigation_id,
                    dimension_name=dec["dimension_name"],
                    magnitude_score=dec["magnitude_score"],
                    affected_years=dec["affected_years"],
                    phrasing_context=dec["phrasing_context"],
                    supporting_data=dec.get("supporting_data"),
                )
                db.add(idec)

            await db.commit()
            timings["divergence_sec"] = round(time.time() - t_intel, 3)
            timings["deterministic_intelligence_sec"] = round(time.time() - t_intel, 3)

            # ── 13. AI (OPTIONAL AI INTERPRETATION) ──────────────────────────
            t_ai = time.time()
            job.progress = 96.0
            job.job_status = "AI"
            job.stage = "ai"
            await db.commit()

            try:
                narratives = generate_narrative(topic_key, topic_key.title(), start_year, end_year, shifts, sentiment)
            except Exception as ai_err:
                print(f"[Worker] Groq AI generation bypassed: {ai_err}")
                narratives = {}
            timings["ai_sec"] = round(time.time() - t_ai, 3)

            # ── 14. COMPLETED / PARTIAL ──────────────────────────────────────
            total_duration = round(time.time() - start_time, 3)
            timings["total_pipeline_sec"] = total_duration
            timings["total_intelligence_sec"] = round(timings.get("deterministic_intelligence_sec", 0) + timings.get("ai_sec", 0), 3)

            sampling_info_meta = {
                "counts_before": sampling_res["counts_before"],
                "counts_after": sampling_res["counts_after"],
                "sparse_years": sampling_res["sparse_years"],
                "sampling_method": sampling_res["sampling_method"],
                "sampling_seed": sampling_res["sampling_seed"],
                "min_sparse_threshold": sampling_res["min_sparse_threshold"],
            }

            valid_dates = [item["pub_date"] for item in usable_articles if item.get("pub_date")]
            if valid_dates:
                # Convert to string if they are datetime objects to ensure string comparison
                str_dates = [d.isoformat() if hasattr(d, 'isoformat') else str(d) for d in valid_dates]
                earliest_source_date = min(str_dates)
                latest_source_date = max(str_dates)
            else:
                earliest_source_date = f"{start_year}-01-01"
                latest_source_date = f"{end_year}-12-31"
            
            perspective_analysis = compute_perspective_analysis(usable_articles, start_year, end_year)

            summary_metadata = {
                "timings": timings,
                "counts": counts,
                "source_breakdown": source_breakdown,
                "per_year_counts": per_year_counts,
                "sampling_info": sampling_info_meta,
                "sparse_years": sampling_res["sparse_years"],
                "earliest_source_date": earliest_source_date,
                "latest_source_date": latest_source_date,
                "total_usable_articles": len(usable_articles),
                "shifts": shifts,
                "sentiment": sentiment,
                "narratives": narratives,
                "perspective_analysis": perspective_analysis,
                "pipeline_version": "3.0.0",
                "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
                "embedding_dimension": 384,
                "sentiment_model": "cardiffnlp/twitter-roberta-base-sentiment-latest",
                "clustering_method": "cosine_similarity_threshold",
                "clustering_parameters": {"threshold": 0.70},
                "sampling_method": "reproducible_random_sample",
                "sampling_seed": 42,
                "completed_at": utc_now().isoformat(),
            }

            investigation.summary_metadata = summary_metadata
            investigation.status = "completed" if usable_articles else "partial"

            job.job_status = "COMPLETED" if usable_articles else "PARTIAL"
            job.progress = 100.0
            job.stage = "completed"
            await db.commit()
            print(f"[Worker] Job {job_id} COMPLETED across 17 explicit states in {total_duration}s. Acquired {len(usable_articles)} articles.")

        except Exception as e:
            print(f"[Worker] Job {job_id} failed with error: {e}")
            job.job_status = "FAILED"
            job.stage = "failed"
            job.error_message = str(e)
            investigation.status = "failed"
            await db.commit()
