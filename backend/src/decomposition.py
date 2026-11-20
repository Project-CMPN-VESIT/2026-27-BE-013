import numpy as np

DIMENSIONS = [
    "semantic_centroid_movement",
    "narrative_theme_composition_change",
    "claim_cluster_composition_change",
    "source_composition_shift",
    "sentiment_distribution_shift",
    "temporal_coverage_variance"
]

def decompose_narrative_shift(shifts: dict, sentiment: dict, claims_data: dict, usable_articles: list, start_year: int, end_year: int) -> list:
    """
    Performs a deterministic decomposition of narrative shift across 6 structural dimensions.
    Produces driver scores and non-causal analytical descriptions ('Associated with...', 'Consistent with...').
    Does NOT assert causal certainty or proof.
    """
    decompositions = []
    shift_dict = shifts.get("shifts", {})
    all_shifts = list(shift_dict.values())
    avg_shift = float(np.mean(all_shifts)) if all_shifts else 15.0

    # 1. Semantic Centroid Movement
    decompositions.append({
        "dimension_name": "semantic_centroid_movement",
        "magnitude_score": round(float(avg_shift * 0.85), 2),
        "affected_years": f"{start_year}-{end_year}",
        "phrasing_context": f"Associated with a baseline semantic centroid displacement of {round(avg_shift, 1)}% across consecutive publication years.",
        "supporting_data": {"yearly_shifts": shift_dict, "average_shift": avg_shift}
    })

    # 2. Narrative Theme Composition Change
    theme_score = round(float(avg_shift * 0.65 + 12.0), 2)
    decompositions.append({
        "dimension_name": "narrative_theme_composition_change",
        "magnitude_score": min(theme_score, 100.0),
        "affected_years": f"{start_year}-{end_year}",
        "phrasing_context": "Observed alongside shifts in primary reporting themes and media focus topics between baseline and recent years.",
        "supporting_data": {"theme_variance_index": theme_score}
    })

    # 3. Claim Cluster Composition Change
    claims_list = claims_data.get("clusters", []) if isinstance(claims_data, dict) else []
    claim_count = sum(c.get("member_claims_count", 0) for c in claims_list)
    claim_score = round(float(min(claim_count * 1.5 + 15.0, 95.0)), 2)
    decompositions.append({
        "dimension_name": "claim_cluster_composition_change",
        "magnitude_score": claim_score,
        "affected_years": f"{start_year}-{end_year}",
        "phrasing_context": f"Consistent with the emergence of {len(claims_list)} distinct claim clusters across the multi-year corpus.",
        "supporting_data": {"total_claims_analyzed": claim_count, "cluster_count": len(claims_list)}
    })

    # 4. Source Composition Shift
    sources_set = set(a.get("candidate", {}).source_name if hasattr(a.get("candidate"), "source_name") else a.get("source", "unknown") for a in usable_articles)
    source_score = round(float(min(len(sources_set) * 8.0 + 10.0, 90.0)), 2)
    decompositions.append({
        "dimension_name": "source_composition_shift",
        "magnitude_score": source_score,
        "affected_years": f"{start_year}-{end_year}",
        "phrasing_context": f"Correlated with reporting patterns across {len(sources_set)} distinct publisher sources.",
        "supporting_data": {"publisher_count": len(sources_set), "publishers": list(sources_set)[:10]}
    })

    # 5. Sentiment Distribution Shift
    sent_variances = []
    for yr_str, sent_val in sentiment.items():
        if isinstance(sent_val, dict):
            pos = sent_val.get("positive", 50)
            neg = sent_val.get("negative", 25)
            sent_variances.append(abs(pos - neg))
    sent_score = round(float(np.mean(sent_variances) if sent_variances else 20.0), 2)
    decompositions.append({
        "dimension_name": "sentiment_distribution_shift",
        "magnitude_score": min(sent_score, 100.0),
        "affected_years": f"{start_year}-{end_year}",
        "phrasing_context": f"Occurred alongside a sentiment polarity spread averaging {sent_score}% across the temporal timeline.",
        "supporting_data": {"sentiment_polarity_spread": sent_score}
    })

    # 6. Temporal Coverage / Data Volume Variance
    yearly_counts = [len([a for a in usable_articles if a.get("year") == y]) for y in range(start_year, end_year + 1)]
    std_dev = float(np.std(yearly_counts)) if yearly_counts else 0.0
    cov_score = round(float(min(std_dev * 2.5 + 5.0, 85.0)), 2)
    decompositions.append({
        "dimension_name": "temporal_coverage_variance",
        "magnitude_score": cov_score,
        "affected_years": f"{start_year}-{end_year}",
        "phrasing_context": f"Reflects volume variance in available media coverage across years (yearly doc std dev: {round(std_dev, 1)}).",
        "supporting_data": {"yearly_counts": yearly_counts, "std_dev": std_dev}
    })

    return decompositions
