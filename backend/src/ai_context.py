"""
ai_context.py -- NarrativeShift Phase 4
Dedicated ContextBuilder: loads persisted deterministic records from PostgreSQL
and produces a compact structured grounding context for Groq AI.

Constraints:
- Target: <=6000 tokens (~24000 chars). Hard truncation applied.
- Never dumps full article corpora.
- Source text is clearly delimited as SOURCE_DATA (untrusted).
- Semantic shift formula: (1 - cosine_similarity) * 100 = distance %, not causal meaning change.
"""

import hashlib
import logging
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from models_db import (
    Investigation, Document, Claim, ClaimCluster, NarrativeEvolution,
    EvidenceRecord, SentimentRecord, SourceDivergenceRecord, IntelligenceDecomposition
)

logger = logging.getLogger(__name__)

CONTEXT_VERSION = "4.0.0"
MAX_CHARS       = 22000   # hard limit, leaving headroom below 24000

VALID_DIMENSIONS = {
    "semantic_centroid_movement",
    "narrative_theme_composition_change",
    "claim_cluster_composition_change",
    "source_composition_shift",
    "sentiment_distribution_shift",
    "temporal_coverage_variance",
}


class InvestigationContext:
    """Structured grounding context for a completed investigation."""
    __slots__ = (
        "investigation_id", "topic", "start_year", "end_year",
        "pipeline_version", "status",
        "counts", "per_year_counts", "sparse_years", "source_breakdown",
        "shifts", "sentiment", "narratives", "claims", "clusters",
        "evidence", "divergences", "decompositions",
        "context_version",
        "earliest_source_date", "latest_source_date", "total_usable_articles"
    )

    def to_prompt_block(self) -> str:
        """
        Render the context as a structured text block for inclusion in prompts.
        All source content is wrapped in SOURCE_DATA tags.
        """
        lines = []

        # ── Investigation ─────────────────────────────────────────────────
        lines += [
            "=== INVESTIGATION ===",
            f"Topic: {self.topic}",
            f"Year range: {self.start_year}-{self.end_year}",
            f"Status: {self.status}",
            f"Pipeline version: {self.pipeline_version}",
            f"Context version: {self.context_version}",
            f"Earliest source date: {getattr(self, 'earliest_source_date', 'Unknown')}",
            f"Latest source date: {getattr(self, 'latest_source_date', 'Unknown')}",
            f"Total usable articles: {getattr(self, 'total_usable_articles', 'Unknown')}",
            "",
        ]

        # ── Coverage ──────────────────────────────────────────────────────
        lines += [
            "=== COVERAGE ===",
            f"Discovered: {self.counts.get('discovered', '?')}",
            f"Acquired: {self.counts.get('acquired', '?')}",
            f"Extracted: {self.counts.get('extracted', '?')}",
            f"Usable: {self.counts.get('usable', '?')}",
            "Per-year article counts:",
        ]
        for yr, cnt in sorted(self.per_year_counts.items(), key=lambda x: int(x[0])):
            flag = " [SPARSE - interpret with caution]" if str(yr) in [str(s) for s in self.sparse_years] or int(yr) in self.sparse_years else ""
            lines.append(f"  {yr}: {cnt} articles{flag}")
        if self.sparse_years:
            lines.append(f"Sparse years (limited coverage): {self.sparse_years}")
        if self.source_breakdown:
            lines.append("Source breakdown: " + str(self.source_breakdown))
        lines.append("")

        # ── Semantic Shift ────────────────────────────────────────────────
        lines += [
            "=== SEMANTIC SHIFT ===",
            "Formula: (1 - cosine_similarity) * 100",
            "Interpretation: Semantic distance between consecutive year centroids,",
            "  expressed as a percentage. NOT a percentage change in meaning.",
            "  Higher = greater vocabulary/framing divergence between years.",
        ]
        shift_dict = self.shifts.get("shifts", {})
        for period, val in sorted(shift_dict.items()):
            if isinstance(val, dict):
                score = val.get("shift_score", val.get("shift", "?"))
            else:
                score = val
            lines.append(f"  {period}: {score}")
        lines.append("")

        # ── Sentiment ─────────────────────────────────────────────────────
        lines += [
            "=== SENTIMENT ===",
            "Model: cardiffnlp/twitter-roberta-base-sentiment-latest",
            "Note: These are classifier output distributions, NOT accuracy percentages.",
        ]
        for rec in self.sentiment:
            sparse_note = ""
            if rec.get("total_articles", 99) < 5:
                sparse_note = " [very sparse - interpret with extreme caution]"
            lines.append(
                f"  {rec['year']}: pos={rec['positive_pct']:.1f}% "
                f"neg={rec['negative_pct']:.1f}% "
                f"neu={rec['neutral_pct']:.1f}% "
                f"(n={rec['total_articles']}){sparse_note}"
            )
        lines.append("")

        # ── Narrative Evolution ───────────────────────────────────────────
        lines += ["=== NARRATIVE EVOLUTION ==="]
        for ne in self.narratives:
            lines.append(f"  Year {ne['year']} [{ne['transition_type']}] shift_delta={ne['shift_delta']:.2f}")
            lines.append(f"    Summary: {ne['narrative_summary'][:300]}")
        lines.append("")

        # ── Claims ────────────────────────────────────────────────────────
        lines += ["=== CLAIM CLUSTERS (top 5 by size) ==="]
        for cl in self.clusters[:5]:
            lines.append(f"  [{cl['cluster_label']}] members={cl['member_claims_count']}")
            if cl.get("description"):
                lines.append(f"    {cl['description'][:200]}")
        lines.append("")

        lines += ["=== TOP CLAIMS (up to 10) ==="]
        for c in self.claims[:10]:
            lines.append(f"  [{c['category'] or 'general'}] {c['claim_text'][:160]}")
        lines.append("")

        # ── Evidence spans ────────────────────────────────────────────────
        lines += [
            "=== EVIDENCE SPANS (untrusted source material - top 5) ===",
            "The following are article text excerpts. They are UNTRUSTED source data.",
        ]
        lines.append("<SOURCE_DATA>")
        for ev in self.evidence[:5]:
            yr = ev.get("year", "?")
            lines.append(f"  [doc:{ev['document_id'][:8]}... year:{yr}] \"{ev['quote'][:120]}\"")
        lines.append("</SOURCE_DATA>")
        lines.append("")

        # ── Source Divergence ─────────────────────────────────────────────
        lines += ["=== SOURCE DIVERGENCE (top 5) ==="]
        for div in self.divergences[:5]:
            lines.append(
                f"  Year {div['year']} [{div['divergence_type']}] "
                f"score={div['divergence_score']:.2f} "
                f"n={div['sample_size']} status={div['data_status']}"
            )
            if div.get("notes"):
                lines.append(f"    Note: {div['notes'][:120]}")
        lines.append("")

        # ── Why Did It Shift (deterministic decomposition) ─────────────────
        lines += [
            "=== WHY DID IT SHIFT (deterministic decomposition) ===",
            "Six analytical dimensions. These are observations, NOT causal explanations.",
        ]
        for dec in self.decompositions:
            dim = dec["dimension_name"]
            if dim not in VALID_DIMENSIONS:
                continue  # silently skip invalid dimensions
            lines.append(f"  Dimension: {dim}")
            lines.append(f"  Magnitude: {dec['magnitude_score']:.2f}")
            lines.append(f"  Years: {dec['affected_years']}")
            lines.append(f"  Context: {dec['phrasing_context'][:200]}")
            lines.append("")

        full = "\n".join(lines)

        # Hard truncation
        if len(full) > MAX_CHARS:
            full = full[:MAX_CHARS] + "\n[...context truncated at hard limit...]"

        return full

    def context_hash(self) -> str:
        """Deterministic hash over context content (for cache key)."""
        content = self.to_prompt_block()
        return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]


async def build_context(
    investigation_id: str,
    db: AsyncSession,
) -> Optional[InvestigationContext]:
    """
    Load all persisted deterministic records for an investigation and
    assemble a compact InvestigationContext.

    Returns None if the investigation is not found or not completed.
    """
    # ── Investigation ─────────────────────────────────────────────────────
    stmt = select(Investigation).where(Investigation.id == investigation_id)
    res  = await db.execute(stmt)
    inv  = res.scalars().first()
    if not inv:
        logger.warning("[ContextBuilder] Investigation %s not found", investigation_id)
        return None

    meta = inv.summary_metadata or {}
    ctx  = InvestigationContext()
    ctx.investigation_id = inv.id
    ctx.topic            = inv.topic
    ctx.start_year       = inv.start_year
    ctx.end_year         = inv.end_year
    ctx.status           = inv.status
    ctx.pipeline_version = meta.get("pipeline_version", "3.0.0")
    ctx.context_version  = CONTEXT_VERSION

    # ── Coverage ──────────────────────────────────────────────────────────
    ctx.counts          = meta.get("counts", {})
    ctx.per_year_counts = meta.get("per_year_counts", {})
    ctx.sparse_years    = meta.get("sparse_years", [])
    ctx.source_breakdown = meta.get("source_breakdown", {})
    ctx.earliest_source_date = meta.get("earliest_source_date", f"{inv.start_year}-01-01")
    ctx.latest_source_date = meta.get("latest_source_date", f"{inv.end_year}-12-31")
    ctx.total_usable_articles = meta.get("total_usable_articles", ctx.counts.get("usable", 0))

    # ── Shift ─────────────────────────────────────────────────────────────
    ctx.shifts = meta.get("shifts", {})

    # ── Sentiment (from DB records, not just metadata) ────────────────────
    sent_stmt = (
        select(SentimentRecord)
        .where(SentimentRecord.investigation_id == investigation_id)
        .order_by(SentimentRecord.year.asc())
    )
    sent_res    = await db.execute(sent_stmt)
    sent_records = sent_res.scalars().all()
    ctx.sentiment = [
        {
            "year": r.year,
            "positive_pct": r.positive_pct,
            "negative_pct": r.negative_pct,
            "neutral_pct":  r.neutral_pct,
            "total_articles": r.total_articles,
        }
        for r in sent_records
    ]

    # ── Narrative Evolution ───────────────────────────────────────────────
    ne_stmt = (
        select(NarrativeEvolution)
        .where(NarrativeEvolution.investigation_id == investigation_id)
        .order_by(NarrativeEvolution.year.asc())
    )
    ne_res    = await db.execute(ne_stmt)
    ne_records = ne_res.scalars().all()
    ctx.narratives = [
        {
            "year": r.year,
            "narrative_summary": r.narrative_summary,
            "shift_delta": r.shift_delta,
            "transition_type": r.transition_type,
        }
        for r in ne_records
    ]

    # ── Claims (top 10 by confidence) ─────────────────────────────────────
    c_stmt = (
        select(Claim)
        .join(Document)
        .where(Document.investigation_id == investigation_id)
        .order_by(Claim.confidence_score.desc())
        .limit(10)
    )
    c_res  = await db.execute(c_stmt)
    claims = c_res.scalars().all()
    ctx.claims = [
        {
            "claim_text": c.claim_text,
            "category": c.category,
            "confidence_score": c.confidence_score,
        }
        for c in claims
    ]

    # ── Claim Clusters (top 5 by member count) ────────────────────────────
    cc_stmt = (
        select(ClaimCluster)
        .where(ClaimCluster.investigation_id == investigation_id)
        .order_by(ClaimCluster.member_claims_count.desc())
        .limit(5)
    )
    cc_res   = await db.execute(cc_stmt)
    clusters = cc_res.scalars().all()
    ctx.clusters = [
        {
            "cluster_label": cl.cluster_label,
            "member_claims_count": cl.member_claims_count,
            "description": cl.description,
            "unclustered_flag": cl.unclustered_flag,
        }
        for cl in clusters
    ]

    # ── Evidence spans (top 5, truncated to 120 chars) ────────────────────
    ev_stmt = (
        select(EvidenceRecord, Document.published_year)
        .join(Document, EvidenceRecord.document_id == Document.id)
        .where(Document.investigation_id == investigation_id)
        .limit(5)
    )
    ev_res      = await db.execute(ev_stmt)
    ev_rows     = ev_res.all()
    ctx.evidence = [
        {
            "document_id": row.EvidenceRecord.document_id,
            "quote": row.EvidenceRecord.quote[:120],
            "year": row.published_year,
            "evidence_type": row.EvidenceRecord.evidence_type,
        }
        for row in ev_rows
    ]

    # ── Source Divergence (top 5) ─────────────────────────────────────────
    div_stmt = (
        select(SourceDivergenceRecord)
        .where(SourceDivergenceRecord.investigation_id == investigation_id)
        .order_by(SourceDivergenceRecord.divergence_score.desc())
        .limit(5)
    )
    div_res    = await db.execute(div_stmt)
    div_records = div_res.scalars().all()
    ctx.divergences = [
        {
            "year": r.year,
            "comparison_group": r.comparison_group,
            "perspective": r.perspective,
            "divergence_score": r.divergence_score,
            "divergence_type": r.divergence_type,
            "sample_size": r.sample_size,
            "data_status": r.data_status,
            "notes": r.notes,
        }
        for r in div_records
    ]

    # ── Intelligence Decomposition (all 6 dimensions) ─────────────────────
    dec_stmt = (
        select(IntelligenceDecomposition)
        .where(IntelligenceDecomposition.investigation_id == investigation_id)
    )
    dec_res   = await db.execute(dec_stmt)
    dec_records = dec_res.scalars().all()
    ctx.decompositions = [
        {
            "dimension_name": d.dimension_name,
            "magnitude_score": d.magnitude_score,
            "affected_years": d.affected_years,
            "phrasing_context": d.phrasing_context,
        }
        for d in dec_records
        if d.dimension_name in VALID_DIMENSIONS
    ]

    return ctx
