import json
import os
import time

RAW_DIR = "data/raw"

SKIP_DOMAINS = [
    "gov", "mil", "edu", "un.org", "who.int",
    "nature.com", "sciencedirect.com", "springer.com",
    "wiley.com", "elsevier.com", "mdpi.com",
    "academia.edu", "researchgate.net", "arxiv.org",
    "nytimes.com", "wsj.com", "ft.com", "economist.com",
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
}


def should_skip(url: str) -> bool:
    return any(d in url for d in SKIP_DOMAINS)


def scrape_article(url: str) -> str:
    """Scrape article body using newspaper3k."""
    if should_skip(url):
        return ""
    try:
        from newspaper import Article, Config
        config                 = Config()
        config.headers         = HEADERS
        config.request_timeout = 15
        config.fetch_images    = False

        a = Article(url, config=config)
        a.download()
        a.parse()
        text = a.text.strip()

        if len(text) > 100:
            paragraphs = [
                p.strip() for p in text.split("\n")
                if len(p.strip()) > 80
            ]
            result = " ".join(paragraphs[:4])
            return result.encode("utf-8", errors="ignore").decode("utf-8")
        return ""
    except Exception:
        return ""


def scrape_topic_year(topic_key: str, year: int,
                       max_scrape: int = 20) -> str:

    slug     = topic_key.replace(" ", "_")
    raw_file = f"{RAW_DIR}/{slug}_{year}_raw.json"
    out_file = f"{RAW_DIR}/{slug}_{year}_scraped.json"

    if os.path.exists(out_file):
        with open(out_file,encoding="utf-8") as f:
            existing = json.load(f)
        if len(existing) > 0:
            print(f"  {year} already scraped ({len(existing)} articles) - scraper.py:67")
            return out_file

    if not os.path.exists(raw_file):
        print(f"️  No raw file for {year}  skipping - scraper.py:71")
        return None

    with open(raw_file,encoding="utf-8") as f:
        articles = json.load(f)

    if not articles:
        print(f"️  No articles for {year} - scraper.py:78")
        return None

    # Articles with body already (Guardian API returns body directly)
    has_body    = [a for a in articles if a.get("body", "").strip()]
    needs_scrape = [a for a in articles if not a.get("body", "").strip()]

    scraped = list(has_body)  # Guardian articles already have body

    # Scrape the ones without body
    to_scrape = needs_scrape[:max_scrape]
    if to_scrape:
        print(f" Scraping {len(to_scrape)} articles for {year} - scraper.py:90"
              f"({len(has_body)} already have body)...")

        for i, art in enumerate(to_scrape):
            url    = art.get("url", "")
            source = art.get("source", "?")
            if not url or should_skip(url):
                continue

            print(f"[{i+1}/{len(to_scrape)}] {source[:25]}... - scraper.py:99",
                  end=" ", flush=True)
            body = scrape_article(url)

            if body:
                art["body"] = body
                scraped.append(art)
                print(f" {len(body)} chars - scraper.py:106")
            else:
                print(" blocked - scraper.py:108")
            time.sleep(1.5)
    else:
        print(f" {year}  all {len(has_body)} articles have body from API - scraper.py:111")

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(scraped, f, indent=2, ensure_ascii=False)

    print(f" {len(scraped)} total articles for {year} - scraper.py:116")
    return out_file


def scrape_topic(topic_key: str, start_year: int,
                  end_year: int, max_scrape: int = 20):
    print(f"\n Processing: {topic_key} - scraper.py:122")
    for year in range(start_year, end_year + 1):
        scrape_topic_year(topic_key, year, max_scrape)
    print(f" Done: {topic_key} - scraper.py:125")