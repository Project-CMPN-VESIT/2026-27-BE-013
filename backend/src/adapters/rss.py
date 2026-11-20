import httpx
import feedparser
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from adapters.base import BaseAdapter, CandidateRecord
from dedup import canonicalize_url, extract_domain
from date_utils import normalize_date, filter_by_year_range

PUBLISHER_RSS_FEEDS = [
    ("https://thewire.in/feed", "The Wire", "left"),
    ("https://scroll.in/feed", "Scroll.in", "left"),
    ("https://www.thehindu.com/news/national/feeder/default.rss", "The Hindu", "centre"),
    ("https://indianexpress.com/section/india/feed/", "Indian Express", "centre"),
    ("http://feeds.bbci.co.uk/news/rss.xml", "BBC News", "centre"),
    ("https://www.aljazeera.com/xml/rss/all.xml", "Al Jazeera", "centre"),
    ("https://www.firstpost.com/rss/india.xml", "Firstpost", "right"),
    ("https://swarajyamag.com/feed", "Swarajya", "right"),
]


class PublisherRSSAdapter(BaseAdapter):
    name = "publisher_rss"

    async def discover(self, topic_query: str, start_year: int, end_year: int) -> list[CandidateRecord]:
        candidates = []
        keywords = [kw.lower().strip() for kw in topic_query.replace(" OR ", ",").split(",") if len(kw.strip()) > 3]

        async with httpx.AsyncClient(timeout=8.0) as client:
            for feed_url, source_name, perspective in PUBLISHER_RSS_FEEDS:
                try:
                    resp = await client.get(feed_url, headers={"User-Agent": "NarrativeShift/2.0"})
                    if resp.status_code == 200:
                        feed = feedparser.parse(resp.text)
                        for entry in feed.entries:
                            title = entry.get("title", "").strip()
                            raw_url = entry.get("link", "")
                            clean_url = canonicalize_url(raw_url)
                            if not clean_url or not title:
                                continue

                            # Check keyword relevance
                            title_lower = title.lower()
                            if not any(kw in title_lower for kw in keywords):
                                continue

                            raw_date = entry.get("published") or entry.get("updated")
                            pub_date = normalize_date(raw_date)
                            in_range, year = filter_by_year_range(pub_date, start_year, end_year)

                            if in_range and year:
                                domain = extract_domain(clean_url)
                                candidates.append(CandidateRecord(
                                    canonical_url=clean_url,
                                    title=title,
                                    source_name=source_name,
                                    domain=domain,
                                    pub_date=pub_date,
                                    published_year=year,
                                    source_type="rss",
                                    discovery_method="publisher_rss",
                                ))
                except Exception as e:
                    print(f"Publisher RSS Adapter notice ({source_name}): {e}")

        return candidates
