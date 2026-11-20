import re
from urllib.parse import urlparse
import numpy as np

# Legitimate media orientation metadata based on standard journalism rating databases (AllSides / Ad Fontes / Reuters Institute)
# Epistemic note: Classifications are metadata for comparative analysis, not absolute or causal claims.
PERSPECTIVE_DOMAINS = {
    # Left / Left-leaning
    "theguardian.com": "left",
    "thewire.in": "left",
    "scroll.in": "left",
    "caravanmagazine.in": "left",
    "frontline.thehindu.com": "left",
    "huffpost.com": "left",
    "vox.com": "left",
    "slate.com": "left",
    "salon.com": "left",
    "newstatesman.com": "left",
    "jacobin.com": "left",
    "motherjones.com": "left",
    "thenation.com": "left",
    "msnbc.com": "left",
    "nytimes.com": "left",
    "washingtonpost.com": "left",
    "economist.com": "left",
    "theatlantic.com": "left",
    "amnesty.org": "left",
    
    # Centre / Broadly balanced / Mainstream institutional
    "reuters.com": "centre",
    "apnews.com": "centre",
    "bbc.com": "centre",
    "bbc.co.uk": "centre",
    "thehindu.com": "centre",
    "indianexpress.com": "centre",
    "ndtv.com": "centre",
    "aljazeera.com": "centre",
    "business-standard.com": "centre",
    "livemint.com": "centre",
    "economictimes.indiatimes.com": "centre",
    "bloomberg.com": "centre",
    "ft.com": "centre",
    "csmonitor.com": "centre",
    "time.com": "centre",
    "news18.com": "centre",
    "timesofindia.indiatimes.com": "centre",
    "indiatoday.in": "centre",
    "hindustantimes.com": "centre",
    "npr.org": "centre",
    "pbs.org": "centre",
    "thehill.com": "centre",
    "usatoday.com": "centre",
    "who.int": "centre",
    "un.org": "centre",
    "nasa.gov": "centre",
    "noaa.gov": "centre",
    "stanford.edu": "centre",
    "jhu.edu": "centre",
    "wmo.int": "centre",
    "worldbank.org": "centre",
    "csis.org": "centre",
    "brookings.edu": "centre",
    "iea.org": "centre",
    "irena.org": "centre",
    "weforum.org": "centre",
    "lse.ac.uk": "centre",
    "columbia.edu": "centre",
    "mit.edu": "centre",
    "nature.com": "centre",
    "spglobal.com": "centre",
    "wiley.com": "centre",
    "ourworldindata.org": "centre",
    "rmi.org": "centre",
    "climatepolicyinitiative.org": "centre",
    "carbonbrief.org": "centre",
    "world-nuclear.org": "centre",
    "europa.eu": "centre",
    
    # Left / Left-leaning
    "americanprogress.org": "left",
    "insideclimatenews.org": "left",
    "climatechangenews.com": "left",
    "ucsusa.org": "left",
    "newamerica.org": "left",
    
    # Right / Right-leaning
    "swarajyamag.com": "right",
    "firstpost.com": "right",
    "opindia.com": "right",
    "telegraph.co.uk": "right",
    "wsj.com": "right",
    "thetimes.co.uk": "right",
    "dailymail.co.uk": "right",
    "foxnews.com": "right",
    "nypost.com": "right",
    "nationalreview.com": "right",
    "washingtontimes.com": "right",
    "wionews.com": "right",
    "republicworld.com": "right",
    "organiser.org": "right",
    "dailywire.com": "right",
    "washingtonexaminer.com": "right",
    "breitbart.com": "right",
}

PERSPECTIVE_NAME_KEYWORDS = {
    "left": ["guardian", "wire", "scroll", "caravan", "frontline", "huffpost", "vox", "slate", "jacobin", "mother jones", "the nation", "new york times", "washington post", "economist", "atlantic", "amnesty", "american progress", "inside climate", "climate home", "concerned scientists", "new america"],
    "centre": ["reuters", "associated press", "ap news", "bbc", "hindu", "indian express", "ndtv", "al jazeera", "business standard", "livemint", "economic times", "bloomberg", "financial times", "time", "news18", "times of india", "india today", "hindustan times", "npr", "pbs", "the hill", "who", "united nations", "nasa", "noaa", "stanford", "johns hopkins", "world meteorological", "world bank", "csis", "brookings", "iea", "irena", "world economic forum", "london school of economics", "columbia", "mit", "nature", "s&p global", "wiley", "our world in data", "rmi", "climate policy initiative", "carbon brief", "world nuclear", "european commission", "kleinman", "ideastream", "resources for the future"],
    "right": ["swarajya", "firstpost", "opindia", "telegraph", "daily mail", "fox news", "new york post", "national review", "wion", "republic", "organiser", "daily wire", "washington examiner", "breitbart"],
}


def classify_perspective(url: str = "", source_name: str = "") -> str:
    """
    Classifies a publisher or article URL into 'left', 'centre', 'right', or 'unknown'.
    Prioritizes canonical domain match, followed by source title match.
    """
    if url:
        parsed = urlparse(url)
        domain = (parsed.netloc or "").lower().replace("www.", "")
        
        # Exact domain match
        if domain in PERSPECTIVE_DOMAINS:
            return PERSPECTIVE_DOMAINS[domain]
            
        # Subdomain / parent domain match
        for d, p in PERSPECTIVE_DOMAINS.items():
            if domain.endswith(d) or d in domain:
                return p

    # Match by source name
    if source_name:
        name_lower = source_name.lower().strip()
        for p, keywords in PERSPECTIVE_NAME_KEYWORDS.items():
            for kw in keywords:
                if kw in name_lower:
                    return p
                    
        # Check if source_name contains a domain-like string
        for d, p in PERSPECTIVE_DOMAINS.items():
            if d in name_lower:
                return p

    return "unknown"


def compute_perspective_analysis(articles: list, start_year: int, end_year: int) -> dict:
    """
    Computes comprehensive comparative perspective analytics across the article corpus:
    1. Overall distribution (count, pct, sources)
    2. Distribution over time (yearly breakdown)
    3. Source to perspective mapping
    4. Sentiment differences across perspectives
    5. Narrative / framing focus per perspective
    6. Cross-perspective divergence
    7. Data sufficiency evaluation
    """
    perspectives = ["left", "centre", "right", "unknown"]
    total_articles = len(articles)
    
    # 1. Classify and group articles
    grouped = {p: [] for p in perspectives}
    source_map = {}
    
    for a in articles:
        url = a.get("canonical_url") or a.get("url") or (a.get("candidate").canonical_url if hasattr(a.get("candidate"), "canonical_url") else "")
        source_name = a.get("source_name") or (a.get("candidate").source_name if hasattr(a.get("candidate"), "source_name") else "") or "Unknown Source"
        pers = a.get("perspective")
        if not pers or pers == "unknown":
            pers = classify_perspective(url, source_name)
            a["perspective"] = pers  # enrich article record
            
        grouped[pers].append(a)
        
        # Record source mapping
        if source_name not in source_map:
            source_map[source_name] = {
                "source_name": source_name,
                "perspective": pers,
                "article_count": 0,
                "sample_titles": [],
            }
        source_map[source_name]["article_count"] += 1
        if len(source_map[source_name]["sample_titles"]) < 2:
            title = a.get("title") or "Report"
            source_map[source_name]["sample_titles"].append(title)

    # 2. Overall Distribution
    overall_dist = {}
    for p in ["left", "centre", "right", "unknown"]:
        arts = grouped[p]
        count = len(arts)
        pct = round((count / total_articles * 100.0), 1) if total_articles > 0 else 0.0
        unique_sources = list(set([a.get("source_name") or "Unknown" for a in arts]))
        
        status = "available" if count > 0 else "zero_articles"
        if p == "unknown" and count == 0:
            status = "not_applicable"
            
        overall_dist[p] = {
            "article_count": count,
            "percentage": pct,
            "source_count": len(unique_sources),
            "sources": unique_sources,
            "status": status,
        }

    # 3. Distribution Over Time (Yearly)
    years = range(start_year, end_year + 1)
    yearly_distribution = []
    
    for yr in years:
        yr_arts = [a for a in articles if a.get("year") == yr]
        yr_total = len(yr_arts)
        yr_left = len([a for a in yr_arts if a.get("perspective") == "left"])
        yr_centre = len([a for a in yr_arts if a.get("perspective") == "centre"])
        yr_right = len([a for a in yr_arts if a.get("perspective") == "right"])
        yr_unknown = len([a for a in yr_arts if a.get("perspective") == "unknown"])
        
        yearly_distribution.append({
            "year": yr,
            "total": yr_total,
            "left_count": yr_left,
            "centre_count": yr_centre,
            "right_count": yr_right,
            "unknown_count": yr_unknown,
            "left_pct": round((yr_left / yr_total * 100.0), 1) if yr_total > 0 else 0.0,
            "centre_pct": round((yr_centre / yr_total * 100.0), 1) if yr_total > 0 else 0.0,
            "right_pct": round((yr_right / yr_total * 100.0), 1) if yr_total > 0 else 0.0,
        })

    # 4. Sentiment Differences Across Perspectives
    sentiment_by_perspective = {}
    for p in ["left", "centre", "right"]:
        p_arts = grouped[p]
        if not p_arts:
            sentiment_by_perspective[p] = {
                "available": False,
                "positive_pct": 0.0,
                "neutral_pct": 0.0,
                "negative_pct": 0.0,
                "sample_size": 0,
            }
            continue
            
        # Extract word-based or explicit sentiment labels
        pos_count = 0
        neg_count = 0
        neu_count = 0
        
        for a in p_arts:
            # If Cardiff sentiment available
            sent_label = a.get("sentiment_label")
            if sent_label == "positive":
                pos_count += 1
            elif sent_label == "negative":
                neg_count += 1
            elif sent_label == "neutral":
                neu_count += 1
            else:
                # Basic tone heuristic based on text
                t = (a.get("text") or a.get("title") or "").lower()
                if any(w in t for w in ["win", "success", "growth", "praise", "milestone", "record", "celebrate"]):
                    pos_count += 1
                elif any(w in t for w in ["critic", "failure", "crisis", "concern", "protest", "clash", "scandal", "warn"]):
                    neg_count += 1
                else:
                    neu_count += 1
                    
        total_p = len(p_arts)
        sentiment_by_perspective[p] = {
            "available": True,
            "positive_pct": round(pos_count / total_p * 100.0, 1),
            "neutral_pct": round(neu_count / total_p * 100.0, 1),
            "negative_pct": round(neg_count / total_p * 100.0, 1),
            "sample_size": total_p,
        }

    # 5. Narrative / Framing Differences
    narrative_differences = {}
    for p in ["left", "centre", "right"]:
        p_arts = grouped[p]
        if not p_arts:
            narrative_differences[p] = {
                "available": False,
                "top_themes": [],
                "sample_quotes": [],
            }
            continue
            
        # Extract frequent descriptive terms
        all_words = " ".join([a.get("title", "") for a in p_arts]).lower()
        words = re.findall(r'\b[a-z]{4,15}\b', all_words)
        stopwords = {"with", "that", "this", "from", "have", "were", "been", "their", "after", "about", "which", "will", "more", "into", "year", "says", "said", "over"}
        freq = {}
        for w in words:
            if w not in stopwords:
                freq[w] = freq.get(w, 0) + 1
        top_themes = [w for w, _ in sorted(freq.items(), key=lambda x: x[1], reverse=True)[:5]]
        
        sample_quotes = [a.get("title") for a in p_arts[:3] if a.get("title")]
        
        narrative_differences[p] = {
            "available": True,
            "top_themes": top_themes,
            "sample_quotes": sample_quotes,
            "sample_size": len(p_arts),
        }

    # 6. Source Composition Shifts
    source_composition_shifts = []
    if len(yearly_distribution) >= 2:
        for i in range(1, len(yearly_distribution)):
            prev = yearly_distribution[i-1]
            curr = yearly_distribution[i]
            source_composition_shifts.append({
                "period": f"{prev['year']} → {curr['year']}",
                "left_shift": round(curr["left_pct"] - prev["left_pct"], 1),
                "centre_shift": round(curr["centre_pct"] - prev["centre_pct"], 1),
                "right_shift": round(curr["right_pct"] - prev["right_pct"], 1),
            })

    # 7. Data Sufficiency Evaluation
    active_perspectives = [p for p in ["left", "centre", "right"] if len(grouped[p]) >= 3]
    is_sufficient = len(active_perspectives) >= 2
    
    if is_sufficient:
        sufficiency_message = (
            f"Multi-perspective comparative data available across {len(active_perspectives)} orientations "
            f"({', '.join([p.capitalize() for p in active_perspectives])}) with valid analytical sample sizes."
        )
    else:
        dominant = max([p for p in ["left", "centre", "right"]], key=lambda p: len(grouped[p])) if any(len(grouped[p]) > 0 for p in ["left", "centre", "right"]) else "unknown"
        sufficiency_message = (
            f"Insufficient cross-perspective data — Dataset contains {len(grouped[dominant])} {dominant.capitalize()} "
            f"articles, but requires multiple orientations with at least 3 articles each for valid comparative divergence."
        )

    return {
        "is_sufficient": is_sufficient,
        "sufficiency_message": sufficiency_message,
        "epistemic_disclaimer": "Source orientation classifications are metadata used for comparative analysis and should not be interpreted as objective judgments.",
        "overall_distribution": overall_dist,
        "yearly_distribution": yearly_distribution,
        "sources_by_perspective": list(source_map.values()),
        "sentiment_by_perspective": sentiment_by_perspective,
        "narrative_differences": narrative_differences,
        "source_composition_shifts": source_composition_shifts,
    }
