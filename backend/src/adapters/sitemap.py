import httpx
from bs4 import BeautifulSoup
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from adapters.base import BaseAdapter, CandidateRecord
from dedup import canonicalize_url, extract_domain
from date_utils import normalize_date, filter_by_year_range


class SitemapAdapter(BaseAdapter):
    name = "publisher_sitemaps"

    async def discover(self, topic_query: str, start_year: int, end_year: int) -> list[CandidateRecord]:
        candidates = []
        keywords = [kw.lower().strip() for kw in topic_query.replace(" OR ", ",").split(",") if len(kw.strip()) > 3]

        async with httpx.AsyncClient(timeout=8.0) as client:
            for year in range(start_year, end_year + 1):
                # Sample daily sitemaps for Swarajya
                for month in [3, 9]:
                    date_str = f"{year}-{month:02d}-15"
                    sitemap_url = f"https://swarajyamag.com/sitemap/sitemap-daily-{date_str}.xml"
                    try:
                        resp = await client.get(sitemap_url, headers={"User-Agent": "NarrativeShift/2.0"})
                        if resp.status_code == 200:
                            soup = BeautifulSoup(resp.content, "xml")
                            for loc in soup.find_all("loc"):
                                raw_url = loc.text.strip()
                                clean_url = canonicalize_url(raw_url)
                                if not clean_url or clean_url.endswith((".jpg", ".png", ".webp")):
                                    continue

                                slug_title = clean_url.split("/")[-1].replace("-", " ").title()
                                if any(kw in slug_title.lower() for kw in keywords):
                                    pub_date = normalize_date(date_str)
                                    candidates.append(CandidateRecord(
                                        canonical_url=clean_url,
                                        title=slug_title,
                                        source_name="Swarajya",
                                        domain="swarajyamag.com",
                                        pub_date=pub_date,
                                        published_year=year,
                                        source_type="sitemap",
                                        discovery_method="swarajya_sitemap",
                                    ))
                    except Exception:
                        pass

        return candidates
