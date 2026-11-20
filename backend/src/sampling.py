import random

SPARSE_YEAR_THRESHOLD = 3
DEFAULT_SAMPLING_SEED = 42

def balance_temporal_samples(usable_articles: list, start_year: int, end_year: int, max_per_year: int = 50, seed: int = DEFAULT_SAMPLING_SEED) -> dict:
    """
    Reproducibly balances article samples per publication year.
    Does not downsample unless a year significantly exceeds max_per_year.
    Flags sparse years (< 3 docs) without manufacturing data.
    """
    random_gen = random.Random(seed)
    
    by_year = {y: [] for y in range(start_year, end_year + 1)}
    for art in usable_articles:
        yr = art.get("year")
        if yr in by_year:
            by_year[yr].append(art)
            
    counts_before = {yr: len(arts) for yr, arts in by_year.items()}
    selected_articles = []
    counts_after = {}
    sparse_years = []
    
    for yr, arts in sorted(by_year.items()):
        cnt = len(arts)
        if cnt < SPARSE_YEAR_THRESHOLD:
            sparse_years.append(yr)
            
        if cnt > max_per_year:
            sampled = random_gen.sample(arts, max_per_year)
        else:
            sampled = list(arts)
            
        counts_after[yr] = len(sampled)
        selected_articles.extend(sampled)
        
    return {
        "selected_articles": selected_articles,
        "counts_before": counts_before,
        "counts_after": counts_after,
        "sparse_years": sparse_years,
        "sampling_method": "reproducible_random_sample",
        "sampling_seed": seed,
        "min_sparse_threshold": SPARSE_YEAR_THRESHOLD,
    }
