import trafilatura
from bs4 import BeautifulSoup
from date_utils import normalize_date


def extract_article_content(html: str, url: str) -> dict:
    """
    Extract title, main text, author, publication date from HTML using Trafilatura.
    Falls back to BeautifulSoup parsing if Trafilatura output is empty.
    """
    if not html or len(html) < 200:
        return {"title": "", "text": "", "author": "", "pub_date": None, "usable": False}

    # Primary extraction using Trafilatura
    try:
        extracted = trafilatura.extract(
            html,
            url=url,
            include_comments=False,
            include_tables=False,
            no_fallback=False,
            output_format="python"
        )
    except Exception:
        extracted = None

    if isinstance(extracted, dict) and extracted.get("text"):
        text = extracted.get("text", "").strip()
        title = extracted.get("title", "").strip()
        author = extracted.get("author", "").strip()
        raw_date = extracted.get("date")
        pub_date = normalize_date(raw_date)

        if len(text.split()) >= 40:
            return {
                "title": title or url.split("/")[-1].replace("-", " ").title(),
                "text": text,
                "author": author,
                "pub_date": pub_date,
                "usable": True,
            }

    # Fallback extraction using BeautifulSoup
    try:
        soup = BeautifulSoup(html, "html.parser")
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header", "aside"]):
            script.decompose()

        title_tag = soup.find("h1") or soup.find("title")
        title = title_tag.text.strip() if title_tag else ""

        paragraphs = [p.text.strip() for p in soup.find_all("p") if len(p.text.strip()) > 60]
        text = " ".join(paragraphs)

        if len(text.split()) >= 40:
            return {
                "title": title or url.split("/")[-1].replace("-", " ").title(),
                "text": text,
                "author": "",
                "pub_date": None,
                "usable": True,
            }
    except Exception:
        pass

    return {"title": "", "text": "", "author": "", "pub_date": None, "usable": False}
