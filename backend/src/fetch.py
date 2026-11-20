import requests
import feedparser
import json
import os
import time
from datetime import datetime
from bs4 import BeautifulSoup

RAW_DIR = "data/raw"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}

GUARDIAN_API = "https://content.guardianapis.com/search"

PERSPECTIVE_MAP = {
    "thewire.in":        "left",
    "scroll.in":         "left",
    "theguardian.com":   "left",
    "thehindu.com":      "centre",
    "indianexpress.com": "centre",
    "bbc.co.uk":         "centre",
    "bbc.com":           "centre",
    "aljazeera.com":     "centre",
    "firstpost.com":     "right",
    "swarajyamag.com":   "right",
    "opindia.com":       "right",
}

ALL_RSS = [
    "https://thewire.in/feed",
    "https://scroll.in/feed",
    "https://www.thehindu.com/news/national/feeder/default.rss",
    "https://indianexpress.com/section/india/feed/",
    "http://feeds.bbci.co.uk/news/rss.xml",
    "https://www.aljazeera.com/xml/rss/all.xml",
    "https://www.firstpost.com/rss/india.xml",
    "https://swarajyamag.com/feed",
]


# ── Helpers ────────────────────────────────────────────────────────────────────

def is_relevant(text: str, query: str) -> bool:
    keywords = []
    for part in query.replace(" OR ", ",").split(","):
        kw = part.lower().strip()
        if len(kw) > 3:
            keywords.append(kw)
        for word in kw.split():
            if len(word) > 4:
                keywords.append(word)
    return any(kw in text.lower() for kw in keywords)


def get_perspective(url: str) -> str:
    for domain, p in PERSPECTIVE_MAP.items():
        if domain in url:
            return p
    return "centre"


def safe_get(url: str, timeout: int = 12) -> requests.Response | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout)
        if r.status_code == 200:
            return r
    except Exception:
        pass
    return None


def scrape_body(url: str) -> str:
    try:
        from newspaper import Article, Config
        config = Config()
        config.browser_user_agent = HEADERS["User-Agent"]
        config.request_timeout    = 15
        config.fetch_images       = False
        a = Article(url, config=config)
        a.download()
        a.parse()
        text = a.text.strip()
        if len(text) > 100:
            paras = [p.strip() for p in text.split("\n") if len(p.strip()) > 80]
            return " ".join(paras[:4])
    except Exception:
        pass
    return ""


# ── Guardian API ───────────────────────────────────────────────────────────────

def fetch_guardian(query: str, year: int,
                   api_key: str, page_size: int = 40) -> list:
    articles = []
    try:
        time.sleep(1)
        r = requests.get(
            GUARDIAN_API,
            params={
                "q":           query,
                "from-date":   f"{year}-01-01",
                "to-date":     f"{year}-12-31",
                "show-fields": "bodyText,headline",
                "page-size":   page_size,
                "order-by":    "relevance",
                "api-key":     api_key,
            },
            timeout=15,
        )
        if r.status_code != 200:
            return []

        for item in r.json()["response"].get("results", []):
            body = item.get("fields", {}).get("bodyText", "")
            if not body:
                continue
            articles.append({
                "title":       item.get("webTitle", "").strip(),
                "url":         item.get("webUrl", ""),
                "source":      "The Guardian",
                "perspective": "left",
                "publishedAt": item["webPublicationDate"][:10],
                "year":        year,
                "body":        body[:2000],
            })
    except Exception as e:
        print(f"      Guardian error: {e}")
    return articles


# ── Swarajya sitemap ───────────────────────────────────────────────────────────

def fetch_swarajya(query: str, year: int, max_articles: int = 20) -> list:
    articles  = []
    seen_urls = set()

    # Sample 2 days per month across the year
    for month in range(1, 13):
        if len(articles) >= max_articles:
            break
        for day in [10, 20]:
            if len(articles) >= max_articles:
                break
            date_str    = f"{year}-{month:02d}-{day:02d}"
            sitemap_url = f"https://swarajyamag.com/sitemap/sitemap-daily-{date_str}.xml"

            r = safe_get(sitemap_url, timeout=10)
            if not r:
                continue

            soup = BeautifulSoup(r.content, "xml")
            urls = [loc.text for loc in soup.find_all("loc")
                    if "swarajyamag.com" in loc.text
                    and not loc.text.endswith((".jpg", ".jpeg", ".png", ".webp"))]

            for url in urls[:3]:
                if url in seen_urls or len(articles) >= max_articles:
                    continue
                seen_urls.add(url)

                body = scrape_body(url)
                if not body:
                    continue

                title = url.split("/")[-1].replace("-", " ").title()
                if not is_relevant(title + " " + body[:300], query):
                    continue

                articles.append({
                    "title":       title,
                    "url":         url,
                    "source":      "Swarajya",
                    "perspective": "right",
                    "publishedAt": date_str,
                    "year":        year,
                    "body":        body[:2000],
                })
                time.sleep(1)

        time.sleep(0.5)

    return articles


# ── OpIndia sitemap ────────────────────────────────────────────────────────────

def fetch_opindia(query: str, year: int, max_articles: int = 20) -> list:
    articles  = []
    seen_urls = set()

    # OpIndia URLs contain the year: opindia.com/2022/...
    # We scan numbered sitemaps and filter by year in URL
    year_str = str(year)

    for sitemap_num in range(1, 80):
        if len(articles) >= max_articles:
            break

        sitemap_url = f"https://www.opindia.com/sitemap-{sitemap_num}.xml"
        r = safe_get(sitemap_url, timeout=10)
        if not r:
            break

        soup = BeautifulSoup(r.content, "xml")
        url_tags = soup.find_all("url")

        found_in_sitemap = False
        for tag in url_tags:
            loc = tag.find("loc")
            if not loc:
                continue
            url = loc.text

            # Filter by year in URL
            if f"/{year_str}/" not in url:
                continue

            found_in_sitemap = True
            if url in seen_urls or len(articles) >= max_articles:
                continue
            seen_urls.add(url)

            body = scrape_body(url)
            if not body:
                continue

            title_tag = tag.find("news:title") or tag.find("title")
            title = title_tag.text.strip() if title_tag else url.split("/")[-1].replace("-", " ").title()

            if not is_relevant(title + " " + body[:300], query):
                continue

            lastmod = tag.find("lastmod")
            pub     = lastmod.text[:10] if lastmod else f"{year}-06-01"

            articles.append({
                "title":       title,
                "url":         url,
                "source":      "OpIndia",
                "perspective": "right",
                "publishedAt": pub,
                "year":        year,
                "body":        body[:2000],
            })
            time.sleep(1)

        # If no URLs for this year found in this sitemap
        # OpIndia sitemaps are ordered newest first
        # If we've gone past our year stop
        all_locs = [tag.find("loc").text for tag in url_tags if tag.find("loc")]
        if all_locs and all(f"/{year_str}/" not in l and
                            int(l.split("/")[3]) < year
                            if len(l.split("/")) > 3 and l.split("/")[3].isdigit()
                            else False
                            for l in all_locs):
            break

        time.sleep(0.5)

    return articles


# ── RSS feeds ──────────────────────────────────────────────────────────────────

def fetch_via_rss(topic_key: str, query: str,
                  year: int, max_articles: int = 20) -> list:
    all_articles = []
    seen_urls    = set()

    for feed_url in ALL_RSS:
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries:
                title = entry.get("title", "").strip()
                url   = entry.get("link", "")
                if not title or not url or url in seen_urls:
                    continue
                try:
                    pub = datetime(*entry.published_parsed[:6])
                    if pub.year != year:
                        continue
                    pub_str = pub.strftime("%Y-%m-%d")
                except Exception:
                    pub_str = f"{year}-06-01"

                if not is_relevant(title, query):
                    continue

                all_articles.append({
                    "title":       title,
                    "url":         url,
                    "source":      feed.feed.get("title", "Unknown"),
                    "perspective": get_perspective(url),
                    "publishedAt": pub_str,
                    "year":        year,
                })
                seen_urls.add(url)

                if len(all_articles) >= max_articles:
                    break
        except Exception:
            pass
        time.sleep(0.3)

    return all_articles


# ── Main fetch ─────────────────────────────────────────────────────────────────

def fetch_year(topic_key: str, query: str, year: int,
               guardian_api_key: str = "",
               max_articles: int = 50) -> str:

    slug        = topic_key.replace(" ", "_")
    output_file = f"{RAW_DIR}/{slug}_{year}_raw.json"
    os.makedirs(RAW_DIR, exist_ok=True)

    if os.path.exists(output_file):
        with open(output_file, encoding="utf-8") as f:
            existing = json.load(f)
        if len(existing) > 0:
            print(f"     {year} cached ({len(existing)} articles)")
            return output_file

    print(f"    Fetching {year}...", end=" ", flush=True)

    all_articles = []
    seen_urls    = set()

    def add(arts):
        for a in arts:
            url = a.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                all_articles.append(a)

    current_year = datetime.now().year

    if year >= current_year - 1:
        # Recent years — RSS is sufficient
        add(fetch_via_rss(topic_key, query, year, 40))
    else:
        # Historical — Guardian (left) + Swarajya (right) + OpIndia (right)
        if guardian_api_key:
            add(fetch_guardian(query, year, guardian_api_key, 30))

        # Right-wing Indian perspective — historical
        print(f"\n      Swarajya...", end=" ", flush=True)
        add(fetch_swarajya(query, year, 15))

        print(f"\n      OpIndia...", end=" ", flush=True)
        add(fetch_opindia(query, year, 15))

        # Supplement with RSS if still low
        if len(all_articles) < 15:
            add(fetch_via_rss(topic_key, query, year, 20))

    final = all_articles[:max_articles]

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(final, f, indent=2, ensure_ascii=False)

    left   = sum(1 for a in final if a.get("perspective") == "left")
    centre = sum(1 for a in final if a.get("perspective") == "centre")
    right  = sum(1 for a in final if a.get("perspective") == "right")

    print(f"\n    {year}: {len(final)} articles [L:{left} C:{centre} R:{right}]")
    return output_file


def fetch_topic(topic_key: str, query: str,
                start_year: int, end_year: int,
                guardian_api_key: str = "",
                max_articles: int = 50):

    print(f"\n Fetching: {topic_key} ({start_year}–{end_year})")
    for year in range(start_year, end_year + 1):
        fetch_year(topic_key, query, year,
                   guardian_api_key, max_articles)
    print(f" Done: {topic_key}")