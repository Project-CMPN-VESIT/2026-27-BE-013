import hashlib
import urllib.parse
import re


TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid", "ref", "mc_cid", "mc_eid", "raw", "action", "sub_id"
}


def canonicalize_url(url: str) -> str:
    """Strip tracking parameters, normalize trailing slashes and scheme/host."""
    if not url:
        return ""

    try:
        parsed = urllib.parse.urlparse(url.strip())
        scheme = parsed.scheme.lower()
        netloc = parsed.netloc.lower()
        
        # Remove default ports
        if netloc.endswith(":80") and scheme == "http":
            netloc = netloc[:-3]
        elif netloc.endswith(":443") and scheme == "https":
            netloc = netloc[:-4]

        # Strip tracking query parameters
        query_pairs = urllib.parse.parse_qsl(parsed.query, keep_blank_values=False)
        clean_pairs = [(k, v) for k, v in query_pairs if k.lower() not in TRACKING_PARAMS]
        clean_query = urllib.parse.urlencode(clean_pairs)

        path = parsed.path
        if path.endswith("/") and len(path) > 1:
            path = path[:-1]

        canonical = urllib.parse.urlunparse((scheme, netloc, path, parsed.params, clean_query, ""))
        return canonical
    except Exception:
        return url.strip().lower()


def compute_content_hash(text_or_url: str) -> str:
    """Compute SHA-256 hash of normalized text or URL."""
    clean_str = re.sub(r"\s+", " ", (text_or_url or "").strip().lower())
    return hashlib.sha256(clean_str.encode("utf-8")).hexdigest()


def extract_domain(url: str) -> str:
    """Extract canonical domain from URL."""
    try:
        parsed = urllib.parse.urlparse(url)
        domain = parsed.netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except Exception:
        return "unknown"
