from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class CandidateRecord:
    canonical_url: str
    title: str
    source_name: str
    domain: str
    pub_date: Optional[datetime]
    published_year: Optional[int]
    description: str = ""
    source_type: str = "publisher"
    discovery_method: str = "adapter"
    author: str = ""


class BaseAdapter:
    """Abstract Base Class for NarrativeShift Source Discovery Adapters."""
    name: str = "base"

    async def discover(self, topic_query: str, start_year: int, end_year: int) -> list[CandidateRecord]:
        raise NotImplementedError("Adapters must implement discover()")
