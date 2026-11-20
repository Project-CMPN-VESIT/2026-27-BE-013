import os
import httpx
from datetime import datetime
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from adapters.base import BaseAdapter, CandidateRecord
from dedup import canonicalize_url, extract_domain
from date_utils import normalize_date, filter_by_year_range


class GuardianAdapter(BaseAdapter):
    name = "guardian"

    async def discover(self, topic_query: str, start_year: int, end_year: int) -> list[CandidateRecord]:
        candidates = []
        api_key = os.environ.get("GUARDIAN_API_KEY", "")
        if not api_key:
            return candidates

        for year in range(start_year, end_year + 1):
            try:
                params = {
                    "q": topic_query,
                    "from-date": f"{year}-01-01",
                    "to-date": f"{year}-12-31",
                    "show-fields": "headline,byline,bodyText",
                    "page-size": 25,
                    "order-by": "relevance",
                    "api-key": api_key,
                }
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get("https://content.guardianapis.com/search", params=params)
                    if resp.status_code == 200:
                        results = resp.json().get("response", {}).get("results", [])
                        for item in results:
                            raw_url = item.get("webUrl", "")
                            clean_url = canonicalize_url(raw_url)
                            if not clean_url:
                                continue

                            title = item.get("webTitle", "").strip()
                            raw_date = item.get("webPublicationDate")
                            pub_date = normalize_date(raw_date)
                            author = item.get("fields", {}).get("byline", "")

                            candidates.append(CandidateRecord(
                                canonical_url=clean_url,
                                title=title,
                                source_name="The Guardian",
                                domain="theguardian.com",
                                pub_date=pub_date,
                                published_year=year,
                                source_type="api",
                                discovery_method="guardian_api",
                                author=author,
                            ))
                    elif resp.status_code == 401:
                        print("Guardian Adapter notice: API key unauthorized. Continuing with other adapters.")
                        break
            except Exception as e:
                print(f"Guardian Adapter notice for year {year}: {e}")

        return candidates
