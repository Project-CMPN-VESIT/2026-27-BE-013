import asyncio
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
import sys
import os
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

load_dotenv()

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

GUARDIAN_KEY = os.environ.get("GUARDIAN_API_KEY", "")
GROQ_KEY     = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL   = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
CORS_ORIGINS_RAW = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CORS_ORIGINS = [origin.strip() for origin in CORS_ORIGINS_RAW.split(",") if origin.strip()]

os.environ["GUARDIAN_API_KEY"] = GUARDIAN_KEY
os.environ["GROQ_API_KEY"]     = GROQ_KEY
os.environ["GROQ_MODEL"]       = GROQ_MODEL

from topics import TOPICS, get_topic
from database import get_db
from models_db import (
    User, Investigation, InvestigationAccess, InvestigationJob, Document, Source,
    Claim, ClaimCluster, EvidenceRecord, ProvenanceRecord, SentimentRecord,
    SourceDivergenceRecord, IntelligenceDecomposition, NarrativeEvolution,
    Article, UserAnnotation
)
from auth import get_current_user, get_optional_user, verify_investigation_owner, verify_investigation_access
from worker import run_investigation_job
from extractor import extract_article_content
from ai_context import build_context
from ai_layer import (
    get_investigation_summary,
    get_why_shift,
    get_narrative_evolution_explanation,
    ask_investigation,
    MAX_QUESTION_LEN,
)
from perspectives import compute_perspective_analysis
from ai_cache import get_cache
from models_db import AIConversation, AIMessage

app = FastAPI(title="NarrativeShift API", version="4.0.0")

import re as _re

# In development, allow any localhost / 127.0.0.1 port automatically so
# Vite port-drift (5174, 5175…) never produces a 400 Disallowed CORS origin.
_LOCALHOST_RE = _re.compile(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$")

def _is_allowed_origin(origin: str) -> bool:
    if origin in CORS_ORIGINS:
        return True
    if os.environ.get("ENVIRONMENT", "development") == "development":
        return bool(_LOCALHOST_RE.match(origin))
    return False

class _DynamicCORSMiddleware:
    """Thin CORS wrapper that checks origins dynamically."""
    def __init__(self, app_inner):
        self._app = app_inner
        self._static = CORSMiddleware(
            app_inner,
            allow_origins=["*"],           # permissive at init
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            headers = dict(scope.get("headers", []))
            origin = headers.get(b"origin", b"").decode()
            if origin and not _is_allowed_origin(origin):
                # Block disallowed origin
                from starlette.responses import Response
                resp = Response("Disallowed CORS origin", status_code=400)
                await resp(scope, receive, send)
                return
        await self._static(scope, receive, send)

# Use CORSMiddleware directly with allow_origins=["*"] for localhost dev
# Real auth security is enforced by JWT Bearer tokens on every protected endpoint.
if os.environ.get("ENVIRONMENT", "development") == "development":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,  # must be False when allow_origins=["*"]
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

MODELS_DIR    = "models"
PROCESSED_DIR = "data/processed"


def load_cached(topic_key: str, start_year: int, end_year: int):
    slug = topic_key.replace(" ", "_")
    sp   = f"{MODELS_DIR}/{slug}_{start_year}_{end_year}_shifts.json"
    sep  = f"{MODELS_DIR}/{slug}_{start_year}_{end_year}_sentiment.json"
    np_  = f"{MODELS_DIR}/{slug}_{start_year}_{end_year}_narratives.json"

    if not (os.path.exists(sp) and os.path.exists(sep)):
        return None

    with open(sp,  encoding="utf-8") as f: shifts    = json.load(f)
    with open(sep, encoding="utf-8") as f: sentiment = json.load(f)
    narratives = {}
    if os.path.exists(np_):
        with open(np_, encoding="utf-8") as f: narratives = json.load(f)

    article_count = 0
    csv = f"{PROCESSED_DIR}/{slug}_clean.csv"
    if os.path.exists(csv):
        try:
            import pandas as pd
            article_count = len(pd.read_csv(csv))
        except Exception:
            pass

    return {
        "shifts":        shifts,
        "sentiment":     sentiment,
        "narratives":    narratives,
        "article_count": article_count,
    }


def groq_call(messages: list, system: str) -> str:
    import requests as rlib
    r = rlib.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {GROQ_KEY}",
            "Content-Type":  "application/json",
        },
        json={
            "model":       GROQ_MODEL,
            "messages":    [{"role": "system", "content": system}] + messages,
            "temperature": 0.4,
            "max_tokens":  1500,
        },
        timeout=30,
    )
    if r.status_code == 200:
        choice = r.json()["choices"][0]
        content = choice["message"]["content"]
        if choice.get("finish_reason") == "length":
            content += "\n\n*(Note: Analysis truncated due to length limits. Ask specific follow-up questions for more detail.)*"
        return content
    return "Could not get response from AI."


# ── Public Endpoints ──────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "status": "NarrativeShift API running",
        "environment": os.environ.get("ENVIRONMENT", "development"),
        "version": "2.0.0"
    }


@app.get("/topics")
def get_all_topics():
    return {
        k: {
            "label":       v["label"],
            "description": v["description"],
            "category":    v["category"],
            "color":       v["color"],
        }
        for k, v in TOPICS.items()
    }


# ── Protected Auth & Profile Endpoints ────────────────────────────────────────

@app.get("/api/auth/me")
async def get_my_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "auth_user_id": current_user.auth_user_id,
        "email": current_user.email,
        "display_name": current_user.display_name,
        "avatar_url": current_user.avatar_url,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }


# ── Protected Asynchronous Investigation Endpoints ───────────────────────────

class CreateInvestigationRequest(BaseModel):
    topic: str
    start_year: int = 2021
    end_year: int = 2024
    search_query: Optional[str] = None


@app.post("/api/investigations")
async def create_investigation(
    req: CreateInvestigationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    investigation = Investigation(
        owner_user_id=current_user.id,
        topic=req.topic.lower().strip(),
        start_year=req.start_year,
        end_year=req.end_year,
        search_query=req.search_query or req.topic,
        status="queued",
    )
    db.add(investigation)
    await db.flush()

    job = InvestigationJob(
        investigation_id=investigation.id,
        job_status="QUEUED",
        stage="queued",
        progress=0.0,
    )
    db.add(job)
    await db.commit()

    # Trigger background worker task asynchronously (fast HTTP response < 0.1s!)
    asyncio.create_task(run_investigation_job(job.id))

    return {
        "investigation_id": investigation.id,
        "job_id": job.id,
        "topic": investigation.topic,
        "status": investigation.status,
        "created_at": investigation.created_at.isoformat(),
    }


@app.get("/api/investigations")
async def list_user_investigations(
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user:
        stmt = select(Investigation).where(Investigation.owner_user_id == current_user.id).order_by(Investigation.created_at.desc())
    else:
        stmt = select(Investigation).order_by(Investigation.created_at.desc()).limit(25)
    res = await db.execute(stmt)
    owned = res.scalars().all()

    def _extract_peak_shift(inv):
        meta = inv.summary_metadata or {}
        shifts = meta.get("shifts", {}).get("shifts", {})
        if shifts:
            try:
                return round(max(float(v) for v in shifts.values()), 2)
            except:
                pass
        return None

    def _extract_article_count(inv):
        meta = inv.summary_metadata or {}
        return meta.get("total_usable_articles") or meta.get("counts", {}).get("usable") or 0

    return [
        {
            "id": inv.id,
            "topic": inv.topic,
            "start_year": inv.start_year,
            "end_year": inv.end_year,
            "status": inv.status,
            "role": "owner",
            "peak_shift": _extract_peak_shift(inv),
            "total_articles": _extract_article_count(inv),
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
            "updated_at": inv.updated_at.isoformat() if inv.updated_at else None,
        }
        for inv in owned
    ]


class UpdateInvestigationRequest(BaseModel):
    topic: Optional[str] = None

@app.put("/api/investigations/{investigation_id}")
async def update_investigation(
    investigation_id: str,
    req: UpdateInvestigationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    investigation = await verify_investigation_owner(investigation_id, current_user, db)
    if req.topic and req.topic.strip():
        investigation.topic = req.topic.strip()
    from datetime import datetime, timezone
    investigation.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(investigation)
    return {
        "id": investigation.id,
        "topic": investigation.topic,
        "status": "updated",
        "updated_at": investigation.updated_at.isoformat()
    }


@app.get("/api/investigations/{investigation_id}")
async def get_investigation_details(
    investigation_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    investigation, role = await verify_investigation_access(investigation_id, current_user, db)
    cached = load_cached(investigation.topic, investigation.start_year, investigation.end_year)

    return {
        "id": investigation.id,
        "owner_user_id": investigation.owner_user_id,
        "topic": investigation.topic,
        "start_year": investigation.start_year,
        "end_year": investigation.end_year,
        "status": investigation.status,
        "user_role": role,
        "metadata": investigation.summary_metadata,
        "data": investigation.summary_metadata or cached,
        "created_at": investigation.created_at.isoformat() if investigation.created_at else None,
    }


@app.get("/api/investigations/{investigation_id}/status")
async def get_investigation_status(
    investigation_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    investigation, role = await verify_investigation_access(investigation_id, current_user, db)
    
    stmt = select(InvestigationJob).where(InvestigationJob.investigation_id == investigation_id).order_by(InvestigationJob.created_at.desc())
    res = await db.execute(stmt)
    job = res.scalars().first()

    return {
        "investigation_id": investigation.id,
        "topic": investigation.topic,
        "status": investigation.status,
        "job_id": job.id if job else None,
        "job_status": job.job_status if job else "unknown",
        "stage": job.stage if job else "unknown",
        "progress": job.progress if job else 0.0,
        "error_message": job.error_message if job else None,
        "metadata": investigation.summary_metadata,
    }


@app.get("/api/investigations/{investigation_id}/results")
async def get_investigation_results(
    investigation_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    investigation, role = await verify_investigation_access(investigation_id, current_user, db)
    cached = load_cached(investigation.topic, investigation.start_year, investigation.end_year)

    data = investigation.summary_metadata or cached or {}
    return {
        "investigation_id": investigation.id,
        "topic": investigation.topic,
        "start_year": investigation.start_year,
        "end_year": investigation.end_year,
        "status": investigation.status,
        "shifts": data.get("shifts", {}),
        "sentiment": data.get("sentiment", {}),
        "narratives": data.get("narratives", {}),
        "timings": data.get("timings", {}),
        "per_year_counts": data.get("per_year_counts", {}),
    }


@app.get("/api/investigations/{investigation_id}/documents")
async def get_investigation_documents(
    investigation_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    await verify_investigation_access(investigation_id, current_user, db)
    
    stmt = select(Document).where(Document.investigation_id == investigation_id).order_by(Document.published_year.asc())
    res = await db.execute(stmt)
    docs = res.scalars().all()

    return [
        {
            "id": d.id,
            "title": d.title,
            "canonical_url": d.canonical_url,
            "published_year": d.published_year,
            "publication_date": d.publication_date.isoformat() if d.publication_date else None,
            "author": d.author,
            "content_hash": d.content_hash,
            "extraction_status": d.extraction_status,
        }
        for d in docs
    ]


@app.get("/api/investigations/{investigation_id}/coverage")
async def get_investigation_coverage(
    investigation_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    investigation, _ = await verify_investigation_access(investigation_id, current_user, db)
    meta = investigation.summary_metadata or {}
    return {
        "investigation_id": investigation.id,
        "counts": meta.get("counts", {}),
        "source_breakdown": meta.get("source_breakdown", {}),
        "per_year_counts": meta.get("per_year_counts", {}),
        "sparse_years": meta.get("sparse_years", []),
        "sampling_info": meta.get("sampling_info", {}),
    }


@app.get("/api/investigations/{investigation_id}/shift")
async def get_investigation_shift(
    investigation_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    investigation, _ = await verify_investigation_access(investigation_id, current_user, db)
    meta = investigation.summary_metadata or {}
    return {
        "investigation_id": investigation.id,
        "metric_name": "Narrative Shift %",
        "formula": "(1 - cosine_similarity) * 100",
        "embedding_model": meta.get("embedding_model", "sentence-transformers/all-MiniLM-L6-v2"),
        "embedding_dimension": meta.get("embedding_dimension", 384),
        "shifts": meta.get("shifts", {}),
    }


@app.get("/api/investigations/{investigation_id}/sentiment")
async def get_investigation_sentiment(
    investigation_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    investigation, _ = await verify_investigation_access(investigation_id, current_user, db)
    stmt = select(SentimentRecord).where(SentimentRecord.investigation_id == investigation_id).order_by(SentimentRecord.year.asc())
    res = await db.execute(stmt)
    records = res.scalars().all()

    return {
        "investigation_id": investigation.id,
        "sentiment_model": "cardiffnlp/twitter-roberta-base-sentiment-latest",
        "yearly_distributions": [
            {
                "year": r.year,
                "positive_pct": r.positive_pct,
                "negative_pct": r.negative_pct,
                "neutral_pct": r.neutral_pct,
                "total_articles": r.total_articles,
            }
            for r in records
        ]
    }


@app.get("/api/investigations/{investigation_id}/narratives")
async def get_investigation_narratives(
    investigation_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    investigation, _ = await verify_investigation_access(investigation_id, current_user, db)
    stmt = select(NarrativeEvolution).where(NarrativeEvolution.investigation_id == investigation_id).order_by(NarrativeEvolution.year.asc())
    res = await db.execute(stmt)
    records = res.scalars().all()

    return {
        "investigation_id": investigation.id,
        "narratives": [
            {
                "id": r.id,
                "year": r.year,
                "narrative_summary": r.narrative_summary,
                "shift_delta": r.shift_delta,
                "transition_type": r.transition_type,
                "supporting_data": r.supporting_data,
            }
            for r in records
        ]
    }


@app.get("/api/investigations/{investigation_id}/claims")
async def get_investigation_claims(
    investigation_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    investigation, _ = await verify_investigation_access(investigation_id, current_user, db)
    
    # Query claim clusters and claims
    cc_stmt = select(ClaimCluster).where(ClaimCluster.investigation_id == investigation_id)
    cc_res = await db.execute(cc_stmt)
    clusters = cc_res.scalars().all()

    c_stmt = select(Claim).join(Document).where(Document.investigation_id == investigation_id)
    c_res = await db.execute(c_stmt)
    claims = c_res.scalars().all()

    return {
        "investigation_id": investigation.id,
        "total_claims": len(claims),
        "total_clusters": len(clusters),
        "clusters": [
            {
                "id": cl.id,
                "cluster_label": cl.cluster_label,
                "description": cl.description,
                "year": cl.year,
                "member_claims_count": cl.member_claims_count,
                "unclustered_flag": cl.unclustered_flag,
                "supporting_data": cl.supporting_data,
            }
            for cl in clusters
        ],
        "claims": [
            {
                "id": c.id,
                "document_id": c.document_id,
                "claim_text": c.claim_text,
                "confidence_score": c.confidence_score,
                "category": c.category,
                "source_name": c.source_name,
                "publication_date": c.publication_date.isoformat() if c.publication_date else None,
            }
            for c in claims
        ]
    }


@app.get("/api/investigations/{investigation_id}/evidence")
async def get_investigation_evidence(
    investigation_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    investigation, _ = await verify_investigation_access(investigation_id, current_user, db)
    stmt = select(EvidenceRecord).join(Document).where(Document.investigation_id == investigation_id)
    res = await db.execute(stmt)
    evidence_items = res.scalars().all()

    return {
        "investigation_id": investigation.id,
        "total_evidence_spans": len(evidence_items),
        "evidence": [
            {
                "id": e.id,
                "claim_id": e.claim_id,
                "document_id": e.document_id,
                "quote": e.quote,
                "start_char": e.start_char,
                "end_char": e.end_char,
                "evidence_type": e.evidence_type,
                "extraction_method": e.extraction_method,
                "sentiment_label": e.sentiment_label,
                "perspective": e.perspective,
            }
            for e in evidence_items
        ]
    }


@app.get("/api/investigations/{investigation_id}/provenance")
async def get_investigation_provenance(
    investigation_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    investigation, _ = await verify_investigation_access(investigation_id, current_user, db)
    stmt = select(ProvenanceRecord).join(Document).where(Document.investigation_id == investigation_id)
    res = await db.execute(stmt)
    provenance_list = res.scalars().all()

    return {
        "investigation_id": investigation.id,
        "total_provenance_records": len(provenance_list),
        "provenance": [
            {
                "id": p.id,
                "document_id": p.document_id,
                "fetch_method": p.fetch_method,
                "http_status": p.http_status,
                "checksum": p.checksum,
                "pipeline_version": p.pipeline_version,
                "fetched_at": p.fetched_at.isoformat() if p.fetched_at else None,
            }
            for p in provenance_list
        ]
    }


@app.get("/api/investigations/{investigation_id}/divergence")
async def get_investigation_divergence(
    investigation_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    investigation, _ = await verify_investigation_access(investigation_id, current_user, db)
    stmt = select(SourceDivergenceRecord).where(SourceDivergenceRecord.investigation_id == investigation_id).order_by(SourceDivergenceRecord.year.asc())
    res = await db.execute(stmt)
    records = res.scalars().all()

    meta = investigation.summary_metadata or {}
    pers_analysis = meta.get("perspective_analysis")
    if not pers_analysis:
        doc_stmt = select(Document).options(selectinload(Document.source)).where(Document.investigation_id == investigation_id)
        doc_res = await db.execute(doc_stmt)
        docs = doc_res.scalars().all()
        arts = [{
            'url': d.canonical_url,
            'title': d.title,
            'year': d.published_year,
            'source_name': d.source.source_name if d.source else 'Unknown',
            'text': d.cleaned_content or ''
        } for d in docs]
        pers_analysis = compute_perspective_analysis(arts, investigation.start_year, investigation.end_year)

    return {
        "investigation_id": investigation.id,
        "divergences": [
            {
                "id": r.id,
                "year": r.year,
                "comparison_group": r.comparison_group,
                "perspective": r.perspective,
                "divergence_score": r.divergence_score,
                "divergence_type": r.divergence_type,
                "sample_size": r.sample_size,
                "data_status": r.data_status,
                "notes": r.notes,
                "supporting_data": r.supporting_data,
            }
            for r in records
        ],
        "perspective_analysis": pers_analysis
    }


@app.get("/api/investigations/{investigation_id}/perspectives")
async def get_investigation_perspectives(
    investigation_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    investigation, _ = await verify_investigation_access(investigation_id, current_user, db)
    meta = investigation.summary_metadata or {}
    pers_analysis = meta.get("perspective_analysis")
    if not pers_analysis:
        doc_stmt = select(Document).options(selectinload(Document.source)).where(Document.investigation_id == investigation_id)
        doc_res = await db.execute(doc_stmt)
        docs = doc_res.scalars().all()
        arts = [{
            'url': d.canonical_url,
            'title': d.title,
            'year': d.published_year,
            'source_name': d.source.source_name if d.source else 'Unknown',
            'text': d.cleaned_content or ''
        } for d in docs]
        pers_analysis = compute_perspective_analysis(arts, investigation.start_year, investigation.end_year)

    return {
        "investigation_id": investigation.id,
        "perspective_analysis": pers_analysis
    }


@app.get("/api/investigations/{investigation_id}/why-shift")
async def get_investigation_why_shift(
    investigation_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    investigation, _ = await verify_investigation_access(investigation_id, current_user, db)
    stmt = select(IntelligenceDecomposition).where(IntelligenceDecomposition.investigation_id == investigation_id)
    res = await db.execute(stmt)
    drivers = res.scalars().all()

    return {
        "investigation_id": investigation.id,
        "analytical_disclaimer": "Non-causal deterministic decomposition of shift drivers ('Associated with...', 'Consistent with...').",
        "drivers": [
            {
                "id": d.id,
                "dimension_name": d.dimension_name,
                "magnitude_score": d.magnitude_score,
                "affected_years": d.affected_years,
                "phrasing_context": d.phrasing_context,
                "supporting_data": d.supporting_data,
            }
            for d in drivers
        ]
    }


@app.delete("/api/investigations/{investigation_id}")
async def delete_investigation(
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    investigation = await verify_investigation_owner(investigation_id, current_user, db)
    await db.delete(investigation)
    await db.commit()
    return {"status": "deleted", "id": investigation_id}


# ── User Opinion / Annotation Endpoints (Phase 4) ─────────────────────────────

class CreateOpinionRequest(BaseModel):
    target_type: str = "investigation"  # investigation, narrative, claim, evidence
    target_id: str = "general"
    note_text: str

class UpdateOpinionRequest(BaseModel):
    note_text: str

@app.post("/api/investigations/{investigation_id}/opinions")
async def create_opinion(
    investigation_id: str,
    req: CreateOpinionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await verify_investigation_access(investigation_id, current_user, db)
    text = req.note_text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Opinion note cannot be empty.")
    if len(text) > 2000:
        raise HTTPException(status_code=400, detail="Opinion note cannot exceed 2000 characters.")
    
    annotation = UserAnnotation(
        investigation_id=investigation_id,
        user_id=current_user.id,
        target_type=req.target_type,
        target_id=req.target_id,
        note_text=text
    )
    db.add(annotation)
    await db.commit()
    await db.refresh(annotation)
    return {
        "id": annotation.id,
        "investigation_id": annotation.investigation_id,
        "user_id": annotation.user_id,
        "user_name": current_user.display_name or current_user.email,
        "avatar_url": current_user.avatar_url,
        "epistemic_type": "USER_OPINION",
        "target_type": annotation.target_type,
        "target_id": annotation.target_id,
        "note_text": annotation.note_text,
        "created_at": annotation.created_at.isoformat(),
        "is_owner": True
    }

@app.get("/api/investigations/{investigation_id}/opinions")
async def list_opinions(
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await verify_investigation_access(investigation_id, current_user, db)
    stmt = select(UserAnnotation, User).join(User, UserAnnotation.user_id == User.id).where(
        UserAnnotation.investigation_id == investigation_id
    ).order_by(UserAnnotation.created_at.asc())
    res = await db.execute(stmt)
    rows = res.all()
    return [
        {
            "id": ann.id,
            "investigation_id": ann.investigation_id,
            "user_id": ann.user_id,
            "user_name": u.display_name or u.email,
            "avatar_url": u.avatar_url,
            "epistemic_type": "USER_OPINION",
            "target_type": ann.target_type,
            "target_id": ann.target_id,
            "note_text": ann.note_text,
            "created_at": ann.created_at.isoformat() if ann.created_at else None,
            "updated_at": ann.updated_at.isoformat() if ann.updated_at else None,
            "is_owner": ann.user_id == current_user.id
        }
        for ann, u in rows
    ]

@app.put("/api/opinions/{opinion_id}")
async def update_opinion(
    opinion_id: str,
    req: UpdateOpinionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(UserAnnotation).where(UserAnnotation.id == opinion_id)
    res = await db.execute(stmt)
    ann = res.scalars().first()
    if not ann:
        raise HTTPException(status_code=404, detail="Opinion not found.")
    if ann.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You can only edit your own opinions.")
    
    text = req.note_text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Opinion note cannot be empty.")
    ann.note_text = text
    from datetime import datetime, timezone
    ann.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(ann)
    return {
        "id": ann.id,
        "note_text": ann.note_text,
        "updated_at": ann.updated_at.isoformat()
    }

@app.delete("/api/opinions/{opinion_id}")
async def delete_opinion(
    opinion_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(UserAnnotation).where(UserAnnotation.id == opinion_id)
    res = await db.execute(stmt)
    ann = res.scalars().first()
    if not ann:
        raise HTTPException(status_code=404, detail="Opinion not found.")
    if ann.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You can only delete your own opinions.")
    await db.delete(ann)
    await db.commit()
    return {"status": "deleted", "id": opinion_id}


# ── Research Articles Workspace (Phases 5 & 6) ────────────────────────────────

class CreateArticleRequest(BaseModel):
    title: str
    description: Optional[str] = None
    body: str = ""
    investigation_id: Optional[str] = None
    visibility: str = "private"
    shared_with: Optional[list] = []

class UpdateArticleRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    body: Optional[str] = None
    visibility: Optional[str] = None
    shared_with: Optional[list] = None

def _format_article(a: Article, current_user_id: str) -> dict:
    return {
        "id": a.id,
        "title": a.title,
        "description": a.description,
        "body": a.body,
        "author_name": a.author_name,
        "visibility": a.visibility,
        "shared_with": a.shared_with or [],
        "investigation_id": a.investigation_id,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        "is_owner": a.owner_user_id == current_user_id,
    }

@app.post("/api/articles")
async def create_article(
    req: CreateArticleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if req.investigation_id:
        await verify_investigation_access(req.investigation_id, current_user, db)
    
    vis = req.visibility.lower() if req.visibility else "private"
    if vis not in ("private", "shared", "public"):
        vis = "private"
    
    title = req.title.strip() if req.title else "Untitled Research Article"
    author_name = current_user.display_name or current_user.email or "Researcher"
    
    article = Article(
        owner_user_id=current_user.id,
        investigation_id=req.investigation_id,
        title=title,
        description=req.description,
        body=req.body or "",
        author_name=author_name,
        visibility=vis,
        shared_with=req.shared_with or [],
    )
    db.add(article)
    await db.commit()
    await db.refresh(article)
    return _format_article(article, current_user.id)

@app.get("/api/articles")
async def list_articles(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Article).where(
        (Article.owner_user_id == current_user.id) |
        (Article.visibility == "public")
    ).order_by(Article.updated_at.desc())
    res = await db.execute(stmt)
    articles = res.scalars().all()
    
    visible = []
    for a in articles:
        if a.owner_user_id == current_user.id:
            visible.append(_format_article(a, current_user.id))
        elif a.visibility == "public":
            visible.append(_format_article(a, current_user.id))
        elif a.visibility == "shared" and a.shared_with and (current_user.id in a.shared_with or current_user.email in a.shared_with):
            visible.append(_format_article(a, current_user.id))
    return visible

@app.get("/api/articles/{article_id}")
async def get_article(
    article_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Article).where(Article.id == article_id)
    res = await db.execute(stmt)
    a = res.scalars().first()
    if not a:
        raise HTTPException(status_code=404, detail="Article not found.")
    
    if a.owner_user_id != current_user.id and a.visibility != "public":
        shared = a.shared_with or []
        if current_user.id not in shared and current_user.email not in shared:
            raise HTTPException(status_code=403, detail="Forbidden: You do not have permission to view this article.")
    
    return _format_article(a, current_user.id)

@app.put("/api/articles/{article_id}")
async def update_article(
    article_id: str,
    req: UpdateArticleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Article).where(Article.id == article_id)
    res = await db.execute(stmt)
    a = res.scalars().first()
    if not a:
        raise HTTPException(status_code=404, detail="Article not found.")
    if a.owner_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: Only the author can edit this article.")
    
    if req.title is not None:
        a.title = req.title.strip() or "Untitled Research Article"
    if req.description is not None:
        a.description = req.description
    if req.body is not None:
        a.body = req.body
    if req.visibility is not None:
        vis = req.visibility.lower()
        if vis in ("private", "shared", "public"):
            a.visibility = vis
    if req.shared_with is not None:
        a.shared_with = req.shared_with
        
    from datetime import datetime, timezone
    a.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(a)
    return _format_article(a, current_user.id)

@app.delete("/api/articles/{article_id}")
async def delete_article(
    article_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Article).where(Article.id == article_id)
    res = await db.execute(stmt)
    a = res.scalars().first()
    if not a:
        raise HTTPException(status_code=404, detail="Article not found.")
    if a.owner_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: Only the author can delete this article.")
    await db.delete(a)
    await db.commit()
    return {"status": "deleted", "id": article_id}

@app.get("/api/public/articles")
async def list_public_articles(
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Article).where(Article.visibility == "public").order_by(Article.updated_at.desc()).limit(50)
    res = await db.execute(stmt)
    articles = res.scalars().all()
    return [
        {
            "id": a.id,
            "title": a.title,
            "description": a.description,
            "author_name": a.author_name,
            "visibility": "public",
            "investigation_id": a.investigation_id,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        }
        for a in articles
    ]

@app.get("/api/public/articles/{article_id}")
async def get_public_article(
    article_id: str,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Article).where(Article.id == article_id, Article.visibility == "public")
    res = await db.execute(stmt)
    a = res.scalars().first()
    if not a:
        raise HTTPException(status_code=404, detail="Public article not found.")
    return {
        "id": a.id,
        "title": a.title,
        "description": a.description,
        "body": a.body,
        "author_name": a.author_name,
        "visibility": "public",
        "investigation_id": a.investigation_id,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


# ── Protected Legacy Endpoints (Auth Required) ────────────────────────────────

class AnalyseRequest(BaseModel):
    topic_key:  str
    start_year: int = 2021
    end_year:   int = 2024


@app.post("/analyse")
async def analyse(
    req: AnalyseRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    cached = load_cached(req.topic_key, req.start_year, req.end_year)

    stmt = select(Investigation).where(
        Investigation.owner_user_id == current_user.id,
        Investigation.topic == req.topic_key.lower().strip(),
        Investigation.start_year == req.start_year,
        Investigation.end_year == req.end_year
    )
    res = await db.execute(stmt)
    inv = res.scalars().first()

    if not inv:
        inv = Investigation(
            owner_user_id=current_user.id,
            topic=req.topic_key.lower().strip(),
            start_year=req.start_year,
            end_year=req.end_year,
            status="completed" if cached else "queued"
        )
        db.add(inv)
        await db.commit()

    if cached:
        return {"status": "cached", "data": cached, "investigation_id": inv.id}

    topic_cfg = get_topic(req.topic_key)

    from pipeline import run_pipeline
    result = run_pipeline(
        topic_key        = req.topic_key,
        topic_config     = topic_cfg,
        start_year       = req.start_year,
        end_year         = req.end_year,
        guardian_api_key = GUARDIAN_KEY,
    )

    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    data = load_cached(req.topic_key, req.start_year, req.end_year)
    return {"status": "computed", "data": data, "investigation_id": inv.id}


class ChatRequest(BaseModel):
    messages: list
    context:  str = ""


@app.post("/chat")
def chat(
    req: ChatRequest,
    current_user: User = Depends(get_current_user)
):
    system = f"""You are an expert media analyst with access to REAL data from news articles.
            You are NOT limited to your training data. The user is providing you with actual computed analysis data.
            Always refer to the provided data in your answers. Never say you don't have access to recent data.
            If context data is provided below, use it as your primary source of truth.
            Current analysis covers real articles published between the specified years."""
    if req.context:
        system += f"\n\n REAL ANALYSIS DATA:\n{req.context}"
    response = groq_call(req.messages, system)
    return {"response": response}


class NewsRequest(BaseModel):
    query:     str = "world news"
    page_size: int = 8


@app.post("/news")
def get_news(
    req: NewsRequest,
    current_user: User | None = Depends(get_optional_user)
):
    import requests as rlib

    query_map = {
        "india": "India",
        "india politics economy": "India",
    }

    search_query = query_map.get(req.query.lower(), req.query)

    params = {
        "q":           search_query,
        "show-fields": "headline,thumbnail",
        "page-size":   req.page_size,
        "order-by":    "newest",
        "api-key":     GUARDIAN_KEY,
    }

    if "india" in req.query.lower():
        params["tag"] = "world/india"
        params.pop("q", None)

    try:
        r = rlib.get(
            "https://content.guardianapis.com/search",
            params=params,
            timeout=10,
        )
        if r.status_code == 200:
            return {"articles": r.json()["response"].get("results", [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"articles": []}


class SummariseRequest(BaseModel):
    url: str


@app.post("/summarise")
async def summarise_article(
    req: SummariseRequest,
    current_user: User | None = Depends(get_optional_user)
):
    url = req.url.strip()
    extracted_text = ""
    title = ""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
            if resp.status_code == 200:
                data = extract_article_content(resp.text, url)
                if data.get("usable"):
                    extracted_text = data.get("text", "")[:3500]
                    title = data.get("title", "")
    except Exception:
        pass

    if extracted_text:
        content_prompt = (
            f"Title: {title}\n"
            f"URL: {url}\n\n"
            f"Article Content:\n{extracted_text}\n\n"
            "Provide a comprehensive, structured analysis of this news article. Use clear markdown sections:\n"
            "## Article Outline\n"
            "(Bullet points summarizing the core events/arguments)\n\n"
            "## Executive Summary\n"
            "(2-3 full paragraphs summarizing the reporting)\n\n"
            "## Narrative Framing & Perspective\n"
            "(Explain how the issue is framed, tone, and political perspective: Left / Centre / Right)\n\n"
            "## Sentiment Analysis\n"
            "(Breakdown of sentiment: Positive, Negative, or Neutral with supporting explanation)\n\n"
            "Ensure every sentence is complete. Do not truncate output."
        )
    else:
        content_prompt = (
            f"URL: {url}\n\n"
            "Summarise the news topic/story at this URL and analyse its narrative framing, sentiment (positive/negative/neutral), and political perspective (left/centre/right).\n"
            "Use clear markdown headings: ## Outline, ## Summary, ## Narrative Framing, and ## Sentiment Analysis.\n"
            "Ensure all sentences and paragraphs are complete."
        )

    response = groq_call(
        [{"role": "user", "content": content_prompt}],
        "You are an expert media intelligence analyst. Provide comprehensive, coherent, and complete media analyses. Never leave thoughts or sentences unfinished."
    )
    return {"summary": response, "title": title}


class GenerateSummaryRequest(BaseModel):
    topic:      str
    start_year: int
    end_year:   int
    shifts:     dict
    sentiment:  dict
    narratives: dict


@app.post("/generate-summary")
def generate_summary(
    req: GenerateSummaryRequest,
    current_user: User = Depends(get_current_user)
):
    context = f"""
Topic: {req.topic} ({req.start_year}–{req.end_year})
Narrative shifts: {json.dumps(req.shifts)}
Sentiment data: {json.dumps(req.sentiment)}
Year narratives: {json.dumps(req.narratives)}
"""
    response = groq_call(
        [{"role": "user", "content": f"Write a comprehensive 300-word media analysis report based on this data: {context}"}],
        "You are a senior media analyst writing professional research reports. Be specific, cite the data, and provide genuine insights about narrative evolution over time."
    )
    return {"summary": response}

# ============================================================
# Phase 4 -- AI Interpretation Endpoints
# All endpoints:
#   1. Authenticate user
#   2. Verify investigation access
#   3. Build grounding context from persisted deterministic data
#   4. Call AI layer (with rate limiting, caching, fallback)
#   5. Return structured response + AI provenance
#
# Deterministic analysis remains available regardless of AI status.
# ============================================================


class AskRequest(BaseModel):
    question: str
    conversation_id: Optional[str] = None


# ── POST /api/investigations/{id}/ai/summary ────────────────────────────────

@app.post("/api/investigations/{investigation_id}/ai/summary")
async def ai_summary(
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a grounded AI executive summary for a completed investigation.
    Returns SYSTEM OBSERVATION labels vs AI INTERPRETATION labels.
    Falls back gracefully if Groq is unavailable.
    """
    investigation, role = await verify_investigation_access(investigation_id, current_user, db)

    if investigation.status not in ("completed", "partial"):
        raise HTTPException(status_code=400, detail="Investigation is not yet completed.")

    context = await build_context(investigation_id, db)
    if not context:
        raise HTTPException(status_code=404, detail="Investigation context not available.")

    response, provenance = await get_investigation_summary(context, db, investigation_id)
    return {
        "investigation_id": investigation_id,
        "topic": investigation.topic,
        "epistemic_type": "AI_INTERPRETATION",
        "ai_result": response,
        "provenance": provenance,
    }


# ── POST /api/investigations/{id}/ai/why-shift ──────────────────────────────

@app.post("/api/investigations/{investigation_id}/ai/why-shift")
async def ai_why_shift(
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    AI interpretation of deterministic 6-dimension shift decomposition.
    All returned drivers are validated against canonical dimension names.
    Non-causal language enforced.
    """
    investigation, role = await verify_investigation_access(investigation_id, current_user, db)

    if investigation.status not in ("completed", "partial"):
        raise HTTPException(status_code=400, detail="Investigation is not yet completed.")

    context = await build_context(investigation_id, db)
    if not context:
        raise HTTPException(status_code=404, detail="Investigation context not available.")

    response, provenance = await get_why_shift(context, investigation_id)
    return {
        "investigation_id": investigation_id,
        "topic": investigation.topic,
        "epistemic_type": "AI_INTERPRETATION",
        "deterministic_disclaimer": (
            "The six dimensions below are deterministic analytical observations, "
            "not causal explanations. AI interpretation uses non-causal language."
        ),
        "ai_result": response,
        "provenance": provenance,
    }


# ── POST /api/investigations/{id}/ai/narrative-evolution ────────────────────

@app.post("/api/investigations/{investigation_id}/ai/narrative-evolution")
async def ai_narrative_evolution(
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    AI explanation of narrative evolution grounded in persisted NarrativeEvolution records.
    """
    investigation, role = await verify_investigation_access(investigation_id, current_user, db)

    if investigation.status not in ("completed", "partial"):
        raise HTTPException(status_code=400, detail="Investigation is not yet completed.")

    context = await build_context(investigation_id, db)
    if not context:
        raise HTTPException(status_code=404, detail="Investigation context not available.")

    response, provenance = await get_narrative_evolution_explanation(context, investigation_id)
    return {
        "investigation_id": investigation_id,
        "topic": investigation.topic,
        "epistemic_type": "AI_INTERPRETATION",
        "ai_result": response,
        "provenance": provenance,
    }


# ── POST /api/investigations/{id}/ai/ask ────────────────────────────────────

@app.post("/api/investigations/{investigation_id}/ai/ask")
async def ai_ask(
    investigation_id: str,
    req: AskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticated Ask AI: answer a user question grounded in investigation evidence.
    Persists conversation and messages. Enforces access control.
    """
    investigation, role = await verify_investigation_access(investigation_id, current_user, db)

    if investigation.status not in ("completed", "partial"):
        raise HTTPException(status_code=400, detail="Investigation is not yet completed.")

    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question must not be empty.")
    if len(question) > MAX_QUESTION_LEN:
        raise HTTPException(status_code=400, detail=f"Question must not exceed {MAX_QUESTION_LEN} characters.")

    # ── Resolve or create conversation ─────────────────────────────────────
    conv = None
    if req.conversation_id:
        stmt = select(AIConversation).where(AIConversation.id == req.conversation_id)
        res  = await db.execute(stmt)
        conv = res.scalars().first()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found.")
        if conv.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied: Not your conversation.")
        if conv.investigation_id and conv.investigation_id != investigation_id:
            raise HTTPException(status_code=403, detail="Conversation belongs to a different investigation.")
    else:
        conv = AIConversation(
            investigation_id=investigation_id,
            user_id=current_user.id,
            title=f"AI Chat: {investigation.topic[:60]}",
        )
        db.add(conv)
        await db.flush()

    # ── Load conversation history (last MAX_HISTORY_MESSAGES) ──────────────
    hist_stmt = (
        select(AIMessage)
        .where(AIMessage.conversation_id == conv.id)
        .order_by(AIMessage.created_at.asc())
    )
    hist_res  = await db.execute(hist_stmt)
    all_msgs  = hist_res.scalars().all()
    history = [
        {"role": m.sender_role, "content": m.content}
        for m in all_msgs[-6:]
    ]

    # ── Build context ────────────────────────────────────────────────────────
    context = await build_context(investigation_id, db)
    if not context:
        raise HTTPException(status_code=404, detail="Investigation context not available.")

    # ── Persist user message ─────────────────────────────────────────────────
    user_msg = AIMessage(
        conversation_id=conv.id,
        sender_role="user",
        content=question,
        context_data={"task_type": "ask"},
    )
    db.add(user_msg)
    await db.flush()

    # ── Call AI ──────────────────────────────────────────────────────────────
    response, provenance = await ask_investigation(context, question, history, investigation_id)

    # ── Persist assistant message ────────────────────────────────────────────
    answer_text = (
        response.get("answer", "AI interpretation temporarily unavailable.")
        if response.get("ai_available")
        else response.get("reason", "AI temporarily unavailable.")
    )
    assistant_msg = AIMessage(
        conversation_id=conv.id,
        sender_role="assistant",
        content=answer_text,
        context_data=provenance,
    )
    db.add(assistant_msg)
    await db.commit()

    return {
        "investigation_id": investigation_id,
        "conversation_id": conv.id,
        "epistemic_type": "AI_INTERPRETATION",
        "question": question,
        "ai_result": response,
        "provenance": provenance,
    }


# ── GET /api/investigations/{id}/ai/conversations ────────────────────────────

@app.get("/api/investigations/{investigation_id}/ai/conversations")
async def list_ai_conversations(
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all AI conversations for this user + investigation."""
    await verify_investigation_access(investigation_id, current_user, db)

    stmt = (
        select(AIConversation)
        .where(
            AIConversation.investigation_id == investigation_id,
            AIConversation.user_id == current_user.id,
        )
        .order_by(AIConversation.updated_at.desc())
    )
    res   = await db.execute(stmt)
    convs = res.scalars().all()

    return [
        {
            "id": c.id,
            "title": c.title,
            "investigation_id": c.investigation_id,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        }
        for c in convs
    ]


# ── GET /api/ai/conversations/{conversation_id}/messages ──────────────────────

@app.get("/api/ai/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return messages for a conversation. Enforces ownership."""
    stmt = select(AIConversation).where(AIConversation.id == conversation_id)
    res  = await db.execute(stmt)
    conv = res.scalars().first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    if conv.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied: Not your conversation.")

    if conv.investigation_id:
        await verify_investigation_access(conv.investigation_id, current_user, db)

    msg_stmt = (
        select(AIMessage)
        .where(AIMessage.conversation_id == conversation_id)
        .order_by(AIMessage.created_at.asc())
    )
    msg_res  = await db.execute(msg_stmt)
    messages = msg_res.scalars().all()

    return {
        "conversation_id": conversation_id,
        "investigation_id": conv.investigation_id,
        "messages": [
            {
                "id": m.id,
                "sender_role": m.sender_role,
                "content": m.content,
                "provenance": m.context_data,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
    }


# ── GET /api/ai/cache/stats ────────────────────────────────────────────────────

@app.get("/api/ai/cache/stats")
async def ai_cache_stats(
    current_user: User = Depends(get_current_user),
):
    """Return AI cache statistics (for monitoring)."""
    cache = get_cache()
    return await cache.stats()
