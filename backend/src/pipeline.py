import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fetch      import fetch_topic
from scraper    import scrape_topic
from preprocess import preprocess
from embeddings import compute_embeddings
from shift      import compute_shift
from sentiment  import compute_sentiment
from narrative  import generate_narrative


def run_pipeline(topic_key: str,
                 topic_config: dict,
                 start_year: int,
                 end_year: int,
                 guardian_api_key: str = "",
                 status_callback=None) -> dict:

    def update(msg):
        print(msg)
        if status_callback:
            status_callback(msg)

    query = topic_config.get("search_query", topic_key)

    update(" Fetching articles from Guardian, Al Jazeera, Swarajya & RSS...")
    fetch_topic(
        topic_key, query, start_year, end_year,
        guardian_api_key=guardian_api_key,
        max_articles=60,
    )

    update(" Processing article bodies...")
    scrape_topic(topic_key, start_year, end_year, max_scrape=20)

    update(" Preprocessing and cleaning...")
    csv = preprocess(topic_key, start_year, end_year)
    if not csv:
        return {"error": "No data found for this topic."}

    update(" Computing semantic embeddings...")
    embeddings, meta = compute_embeddings(topic_key)
    if embeddings is None:
        return {"error": "Embedding failed."}

    update(" Computing narrative shift...")
    shifts = compute_shift(topic_key, start_year, end_year)
    if not shifts:
        return {"error": "Shift computation failed."}

    update(" Analysing sentiment by perspective...")
    sentiment = compute_sentiment(topic_key, start_year, end_year)

    update("️  Generating narrative summaries via Groq...")
    narratives = generate_narrative(
        topic_key,
        topic_config.get("label", topic_key),
        start_year, end_year,
        shifts, sentiment,
    )

    return {
        "shifts":     shifts,
        "sentiment":  sentiment,
        "narratives": narratives,
    }