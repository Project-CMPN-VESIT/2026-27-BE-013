import urllib.parse
import httpx
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from adapters.base import BaseAdapter, CandidateRecord
from dedup import canonicalize_url, extract_domain
from date_utils import normalize_date, filter_by_year_range


class GDELTAdapter(BaseAdapter):
    name = "gdelt"

    async def discover(self, topic_query: str, start_year: int, end_year: int) -> list[CandidateRecord]:
        candidates = []
        encoded_query = urllib.parse.quote(topic_query)
        
        # GDELT DOC API v2
        url = (
            f"https://api.gdeltproject.org/api/v2/doc/doc?"
            f"query={encoded_query}&mode=artlist&maxrecords=75&format=json"
            f"&startdatetime={start_year}0101000000&enddatetime={end_year}1231235959"
        )

        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.get(url, headers={"User-Agent": "NarrativeShift/2.0"})
                if resp.status_code == 200:
                    data = resp.json()
                    articles = data.get("articles", [])
                    for item in articles:
                        raw_url = item.get("url", "")
                        clean_url = canonicalize_url(raw_url)
                        if not clean_url:
                            continue

                        title = item.get("title", "").strip()
                        raw_date = item.get("seendate") or item.get("pubdate")
                        pub_date = normalize_date(raw_date)
                        in_range, year = filter_by_year_range(pub_date, start_year, end_year)

                        if in_range and year:
                            domain = extract_domain(clean_url)
                            candidates.append(CandidateRecord(
                                canonical_url=clean_url,
                                title=title or clean_url.split("/")[-1].replace("-", " ").title(),
                                source_name=item.get("domain") or domain,
                                domain=domain,
                                pub_date=pub_date,
                                published_year=year,
                                source_type="api",
                                discovery_method="gdelt",
                            ))
        except Exception as e:
            print(f"GDELT Adapter notice: {e}")

        return candidates
