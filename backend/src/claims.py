import re

ASSERTION_KEYWORDS = [
    "announced", "launched", "increased", "decreased", "shifted", "argued",
    "stated", "reported", "projected", "expanded", "warned", "demanded",
    "invested", "approved", "banned", "passed", "introduced", "transformed",
    "surpassed", "declined", "accelerated", "adopted", "ruled", "concluded"
]

BOILERPLATE_PATTERNS = [
    r"^copyright", r"^all rights reserved", r"^subscribe to", r"^read more",
    r"^click here", r"^follow us", r"^terms of use", r"^privacy policy",
    r"^cookie policy", r"^sign up"
]

def extract_claims_from_documents(documents: list) -> list:
    """
    Extracts quality-controlled analytical claims from document text.
    Filters boilerplate, navigation snippets, and duplicate/trivial statements.
    Preserves exact linkage to parent document ID, publication date, and source.
    """
    extracted_claims = []
    seen_claim_texts = set()

    for doc in documents:
        doc_id = doc.get("id") or doc.get("canonical_url")
        content = doc.get("cleaned_content") or doc.get("text") or ""
        source_name = doc.get("source_name") or doc.get("source") or "Unknown"
        pub_date = doc.get("pub_date") or doc.get("publication_date")

        # Split into sentences
        sentences = re.split(r'(?<=[.!?])\s+', content)
        for sent in sentences:
            sent_str = sent.strip()
            # Quality Controls:
            # 1. Length check: between 40 and 250 characters
            if len(sent_str) < 40 or len(sent_str) > 250:
                continue
            
            # 2. Boilerplate removal
            sent_lower = sent_str.lower()
            if any(re.search(pat, sent_lower) for pat in BOILERPLATE_PATTERNS):
                continue
                
            # 3. Deduplication check
            clean_key = re.sub(r'\s+', ' ', sent_lower)
            if clean_key in seen_claim_texts:
                continue

            # 4. Check for assertion indicator keywords or structural claim traits
            has_keyword = any(kw in sent_lower for kw in ASSERTION_KEYWORDS)
            has_digits = bool(re.search(r'\d', sent_str))
            
            if has_keyword or has_digits:
                confidence = 0.95 if (has_keyword and has_digits) else 0.85
                seen_claim_texts.add(clean_key)
                
                extracted_claims.append({
                    "document_id": doc_id,
                    "claim_text": sent_str,
                    "confidence_score": confidence, # Represents text extraction quality, NOT factual truth
                    "category": "market_policy" if has_digits else "general_discourse",
                    "source_name": source_name,
                    "publication_date": pub_date,
                    "year": doc.get("year"),
                })
                
                # Limit claims per document to prevent flood
                doc_claims = [c for c in extracted_claims if c["document_id"] == doc_id]
                if len(doc_claims) >= 5:
                    break

    return extracted_claims

def seen_claims_key(seen_set, new_key):
    seen_set.add(new_key)
    return new_key
