import pandas as pd
import numpy as np
import json
import os
from transformers import pipeline

PROCESSED_DIR = "data/processed"
MODELS_DIR    = "models"

_sentiment_model = None

def get_sentiment_model():
    global _sentiment_model
    if _sentiment_model is None:
        print("[Sentiment] Loading sentiment model... - sentiment.py:15")
        _sentiment_model = pipeline(
            "sentiment-analysis",
            model="cardiffnlp/twitter-roberta-base-sentiment-latest",
            truncation=True,
            max_length=512,
        )
    return _sentiment_model


def compute_sentiment(topic_key: str,
                      start_year: int,
                      end_year: int) -> dict:

    slug     = topic_key.replace(" ", "_")
    csv_path = f"{PROCESSED_DIR}/{slug}_clean.csv"
    out_path = f"{MODELS_DIR}/{slug}_{start_year}_{end_year}_sentiment.json"

    if os.path.exists(out_path):
        print(f"[Sentiment] Loading cached sentiment - sentiment.py:34")
        with open(out_path) as f:
            return json.load(f)

    if not os.path.exists(csv_path):
        print(f"[Notice] No CSV for {topic_key} - sentiment.py:39")
        return {}

    df        = pd.read_csv(csv_path)
    scorer    = get_sentiment_model()
    all_years = sorted(df["year"].unique())
    years     = [y for y in all_years if start_year <= y <= end_year]
    results   = {}

    for year in years:
        texts  = df[df["year"] == year]["text"].fillna("").tolist()
        texts  = [t[:512] for t in texts]
        if not texts:
            continue

        scores = scorer(texts, batch_size=16, truncation=True)

        pos = sum(1 for s in scores if s["label"] in ["positive", "POSITIVE", "LABEL_2"])
        neg = sum(1 for s in scores if s["label"] in ["negative", "NEGATIVE", "LABEL_0"])
        neu = len(scores) - pos - neg

        total = len(scores)
        results[int(year)] = {
            "positive": round(pos / total * 100, 1),
            "negative": round(neg / total * 100, 1),
            "neutral":  round(neu / total * 100, 1),
            "total":    total,
        }
        print(f"{year}  {results[int(year)]['positive']}% pos / {results[int(year)]['negative']}% neg / {results[int(year)]['neutral']}% neu - sentiment.py:67")

    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)

    print(f" Sentiment saved - sentiment.py:72")
    return results