import re
from datetime import datetime, timezone
import dateparser


def normalize_date(date_input: str | datetime | None) -> datetime | None:
    """Normalize raw date strings or datetime objects into timezone-aware UTC datetime."""
    if not date_input:
        return None

    if isinstance(date_input, datetime):
        if date_input.tzinfo is None:
            return date_input.replace(tzinfo=timezone.utc)
        return date_input.astimezone(timezone.utc)

    date_str = str(date_input).strip()
    if not date_str:
        return None

    # Common year extraction regex for fallback
    match = re.search(r"\b(19|20)\d{2}\b", date_str)
    fallback_year = int(match.group(0)) if match else None

    try:
        dt = dateparser.parse(
            date_str,
            settings={
                "TIMEZONE": "UTC",
                "RETURN_AS_TIMEZONE_AWARE": True,
                "PREFER_DAY_OF_MONTH": "first",
            },
        )
        if dt:
            return dt
    except Exception:
        pass

    if fallback_year:
        return datetime(fallback_year, 6, 1, tzinfo=timezone.utc)

    return None


def filter_by_year_range(pub_date: datetime | None, start_year: int, end_year: int) -> tuple[bool, int | None]:
    """Check if publication date falls strictly within [start_year, end_year]."""
    if not pub_date:
        return False, None

    year = pub_date.year
    in_range = (start_year <= year <= end_year)
    return in_range, year
