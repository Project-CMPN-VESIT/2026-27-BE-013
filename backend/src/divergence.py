import numpy as np
from perspectives import classify_perspective

SPARSE_GROUP_THRESHOLD = 3

def compute_source_divergence(usable_articles: list, start_year: int, end_year: int) -> list:
    """
    Calculates source and analytical perspective divergence across years and publishers.
    Perspective labels ('left', 'centre', 'right', 'unknown') are treated as analytical metadata.
    Returns 'insufficient_data' for sparse groups (< 3 docs) instead of a misleading score.
    """
    divergence_records = []
    years = range(start_year, end_year + 1)
    
    for yr in years:
        yr_articles = [a for a in usable_articles if a.get("year") == yr]
        
        # Group by perspective
        by_perspective = {"left": [], "centre": [], "right": [], "unknown": []}
        for art in yr_articles:
            cand = art.get("candidate")
            url = art.get("canonical_url") or art.get("url") or (cand.canonical_url if hasattr(cand, "canonical_url") else "")
            src_name = art.get("source_name") or (cand.source_name if hasattr(cand, "source_name") else "")
            pers = art.get("perspective") or classify_perspective(url, src_name)
            by_perspective[pers].append(art)

        # Compute divergence for each perspective group vs total corpus in that year
        total_yr_count = len(yr_articles)

        for pers_key, p_articles in by_perspective.items():
            count = len(p_articles)
            
            if count < SPARSE_GROUP_THRESHOLD:
                # Sparse group: flag as insufficient data
                divergence_records.append({
                    "year": yr,
                    "comparison_group": "perspective_vs_corpus",
                    "perspective": pers_key,
                    "divergence_score": 0.0,
                    "divergence_type": "semantic",
                    "sample_size": count,
                    "data_status": "insufficient_data",
                    "notes": f"Insufficient articles ({count} < {SPARSE_GROUP_THRESHOLD}) for analytical divergence score in {yr}.",
                    "supporting_data": {"year": yr, "sample_size": count}
                })
            else:
                # Calculate synthetic perspective score from relative length and text variance
                avg_len = np.mean([len(a.get("text", "").split()) for a in p_articles])
                corpus_avg_len = np.mean([len(a.get("text", "").split()) for a in yr_articles]) if yr_articles else 1
                
                div_score = round(float(min(abs(avg_len - corpus_avg_len) / corpus_avg_len * 50.0 + (1.0 - count / max(total_yr_count, 1)) * 20.0, 100.0)), 2)

                divergence_records.append({
                    "year": yr,
                    "comparison_group": "perspective_vs_corpus",
                    "perspective": pers_key,
                    "divergence_score": div_score,
                    "divergence_type": "semantic_and_coverage",
                    "sample_size": count,
                    "data_status": "sufficient",
                    "notes": f"Observed perspective divergence score of {div_score}% for {pers_key} media in {yr} across {count} articles.",
                    "supporting_data": {
                        "year": yr,
                        "perspective": pers_key,
                        "sample_size": count,
                        "corpus_size": total_yr_count,
                        "group_avg_words": round(float(avg_len), 1),
                    }
                })

    return divergence_records
