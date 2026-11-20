from adapters.gdelt import GDELTAdapter
from adapters.google_news import GoogleNewsRSSAdapter
from adapters.guardian import GuardianAdapter
from adapters.rss import PublisherRSSAdapter
from adapters.sitemap import SitemapAdapter

ALL_DISCOVERY_ADAPTERS = [
    GDELTAdapter(),
    GoogleNewsRSSAdapter(),
    GuardianAdapter(),
    PublisherRSSAdapter(),
    SitemapAdapter(),
]
