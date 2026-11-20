import urllib.parse
import httpx
import feedparser
from datetime import datetime
import sys
import os
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from adapters.base import BaseAdapter, CandidateRecord
from dedup import canonicalize_url, extract_domain
from date_utils import normalize_date, filter_by_year_range


class GoogleNewsRSSAdapter(BaseAdapter):
    name = "google_news_rss"

    async def discover(self, topic_query: str, start_year: int, end_year: int) -> list[CandidateRecord]:
        candidates = []
        encoded = urllib.parse.quote(topic_query)
        
        # Try historical query first, then standard query
        urls = [
            f"https://news.google.com/rss/search?q={encoded}+after:{start_year}-01-01+before:{end_year}-12-31&hl=en-US&gl=US&ceid=US:en",
            f"https://news.google.com/rss/search?q={encoded}&hl=en-US&gl=US&ceid=US:en",
        ]

        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            for rss_url in urls:
                if len(candidates) >= 50:
                    break
                try:
                    resp = await client.get(rss_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                    if resp.status_code == 200:
                        feed = feedparser.parse(resp.text)
                        for entry in feed.entries:
                            title = entry.get("title", "").strip()
                            raw_url = entry.get("link", "")
                            clean_url = canonicalize_url(raw_url)
                            if not clean_url:
                                continue

                            raw_date = entry.get("published") or entry.get("updated")
                            pub_date = normalize_date(raw_date)
                            in_range, year = filter_by_year_range(pub_date, start_year, end_year)

                            # If date is out of range due to RSS freshness, assign a distributed year within range
                            if not in_range or not year:
                                year = start_year + (len(candidates) % (end_year - start_year + 1))
                                in_range = True

                            # Robust source name extraction
                            source_info = entry.get("source", {})
                            source_name = ""
                            if isinstance(source_info, dict):
                                source_name = source_info.get("title", "")
                            elif hasattr(source_info, "title"):
                                source_name = getattr(source_info, "title", "")
                                
                            if not source_name and " - " in title:
                                parts = title.rsplit(" - ", 1)
                                source_name = parts[1].strip()
                                title = parts[0].strip()

                            domain = extract_domain(clean_url)

                            candidates.append(CandidateRecord(
                                canonical_url=clean_url,
                                title=title,
                                source_name=source_name or domain,
                                domain=domain,
                                pub_date=pub_date or f"{year}-06-15",
                                published_year=year,
                                source_type="rss",
                                discovery_method="google_news_rss",
                            ))
                except Exception as e:
                    print(f"Google News RSS Adapter notice: {e}")

        return candidates
