import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
import json
import os

MODELS_DIR = "models"


def compute_shift(topic_key: str, start_year: int, end_year: int) -> dict:
    slug      = topic_key.replace(" ", "_")
    emb_path  = f"{MODELS_DIR}/{slug}_embeddings.npy"
    meta_path = f"{MODELS_DIR}/{slug}_meta.csv"
    out_path  = f"{MODELS_DIR}/{slug}_{start_year}_{end_year}_shifts.json"

    if os.path.exists(out_path):
        print(f"[Shift] Loading cached shifts - shift.py:17")
        with open(out_path, encoding="utf-8") as f:
            return json.load(f)

    if not os.path.exists(emb_path) or not os.path.exists(meta_path):
        print(f"[Notice] No embeddings for {topic_key} - shift.py:22")
        return {}

    embeddings = np.load(emb_path)
    df         = pd.read_csv(meta_path)

    if "year" not in df.columns:
        print(f"[Notice] No year column in meta - shift.py:29")
        return {}

    all_years = sorted(df["year"].unique())
    years     = [y for y in all_years if start_year <= y <= end_year]

    if len(years) < 2:
        print(f"[Notice] Need at least 2 years, got {years} - shift.py:36")
        # Return single year data so pipeline doesn't fail completely
        if len(years) == 1:
            return {
                "years":  [int(years[0])],
                "shifts": {},
            }
        return {}

    centroids = {}
    for year in years:
        idx = df[df["year"] == year].index.tolist()
        if len(idx) == 0:
            continue
        centroids[year] = embeddings[idx].mean(axis=0)

    shifts = {}
    valid_years = sorted(centroids.keys())
    for i in range(1, len(valid_years)):
        y1, y2 = valid_years[i-1], valid_years[i]
        sim     = cosine_similarity([centroids[y1]], [centroids[y2]])[0][0]
        shift   = round(float((1 - sim) * 100), 2)
        shifts[f"{int(y1)}-{int(y2)}"] = shift

    result = {
        "years":  [int(y) for y in valid_years],
        "shifts": shifts,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    print(f" Shifts computed: {shifts} - shift.py:68")
    return result