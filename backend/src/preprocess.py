import json
import os
import pandas as pd

RAW_DIR       = "data/raw"
PROCESSED_DIR = "data/processed"


def load_articles(topic_key: str, year: int) -> list:
    slug     = topic_key.replace(" ", "_")
    out_file = f"{RAW_DIR}/{slug}_{year}_scraped.json"
    raw_file = f"{RAW_DIR}/{slug}_{year}_raw.json"
    rows     = []

    # Prefer scraped file (has body text)
    source_file = out_file if os.path.exists(out_file) else raw_file
    if not os.path.exists(source_file):
        return []

    with open(source_file, encoding="utf-8") as f:
        articles = json.load(f)

    for a in articles:
        title       = (a.get("title") or "").strip()
        body        = (a.get("body") or "").strip()
        text        = (title + " " + body).strip() if body else title
        perspective = a.get("perspective", "centre")
        source      = a.get("source", "unknown")

        if len(text) < 30:
            continue

        rows.append({
            "text":        text[:1500],
            "year":        year,
            "source":      source,
            "perspective": perspective,
            "url":         a.get("url", ""),
            "type":        "full" if body else "headline",
        })

    return rows


def preprocess(topic_key: str, start_year: int, end_year: int) -> str:
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    slug    = topic_key.replace(" ", "_")
    outpath = f"{PROCESSED_DIR}/{slug}_clean.csv"

    all_rows = []
    for year in range(start_year, end_year + 1):
        rows   = load_articles(topic_key, year)
        full   = sum(1 for r in rows if r["type"] == "full")
        left   = sum(1 for r in rows if r["perspective"] == "left")
        centre = sum(1 for r in rows if r["perspective"] == "centre")
        right  = sum(1 for r in rows if r["perspective"] == "right")
        print(f"{year}  {len(rows)} articles - preprocess.py:57"
              f"[full:{full}] [L:{left} C:{centre} R:{right}]")
        all_rows.extend(rows)

    if not all_rows:
        print(f"️  No data for {topic_key} - preprocess.py:62")
        return None

    df = pd.DataFrame(all_rows)
    df = df.drop_duplicates(subset="text").reset_index(drop=True)
    df.to_csv(outpath, index=False, encoding="utf-8")
    print(f" Saved {len(df)} rows  {outpath} - preprocess.py:68")
    return outpath