import ipaddress
import socket
import urllib.parse
import httpx
import asyncio

BLOCKED_IP_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36 NarrativeShiftBot/2.0"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def is_safe_url(url: str) -> tuple[bool, str]:
    """
    SSRF Protection Guard:
    Validates URL scheme, resolves hostname DNS, and rejects internal/loopback/cloud metadata IPs.
    """
    if not url or not isinstance(url, str):
        return False, "Empty or non-string URL"

    try:
        parsed = urllib.parse.urlparse(url.strip())
        scheme = parsed.scheme.lower()
        if scheme not in ("http", "https"):
            return False, f"Prohibited URL scheme: {scheme}"

        hostname = parsed.hostname
        if not hostname:
            return False, "Missing hostname in URL"

        if hostname.lower() in ("localhost", "loopback", "metadata.google.internal"):
            return False, f"Blocked hostname: {hostname}"

        # Resolve DNS IP addresses
        ips = socket.getaddrinfo(hostname, None)
        for family, socktype, proto, canonname, sockaddr in ips:
            ip_str = sockaddr[0]
            ip_obj = ipaddress.ip_address(ip_str)
            for net in BLOCKED_IP_NETWORKS:
                if ip_obj in net:
                    return False, f"Blocked internal IP address: {ip_str}"

        return True, "Safe"
    except Exception as e:
        return False, f"URL security check failed: {e}"


async def fetch_article_html(url: str, client: httpx.AsyncClient, semaphore: asyncio.Semaphore) -> tuple[str, str, int]:
    """
    Fetch HTML content of an article asynchronously with SSRF checks, semaphores, and timeouts.
    Returns (url, html_content, http_status).
    """
    is_safe, reason = is_safe_url(url)
    if not is_safe:
        print(f"[SSRF Guard] Blocked {url}: {reason}")
        return url, "", 403

    async with semaphore:
        try:
            resp = await client.get(url, headers=HEADERS, timeout=10.0, follow_redirects=True)
            if resp.status_code == 200:
                # Content size check (max 5MB)
                if len(resp.content) > 5 * 1024 * 1024:
                    return url, "", 413
                return url, resp.text, 200
            return url, "", resp.status_code
        except Exception as e:
            return url, "", 500
