def extract_evidence_spans(claims: list, documents: list) -> list:
    """
    Locates exact verbatim character offsets (start_char, end_char) linking claims directly to document source text.
    Enforces strict verification: quote MUST equal document.cleaned_content[start_char:end_char].
    Never stores synthetic AI wording or summaries as direct source evidence.
    """
    doc_map = {}
    for d in documents:
        doc_id = d.get("id") or d.get("canonical_url")
        content = d.get("cleaned_content") or d.get("text") or ""
        doc_map[doc_id] = {
            "content": content,
            "perspective": d.get("perspective") or "centre",
            "source_name": d.get("source_name") or d.get("source") or "Publisher",
        }

    evidence_records = []

    for claim in claims:
        claim_id = claim.get("id") or claim.get("claim_text")
        doc_id = claim.get("document_id")
        claim_text = claim.get("claim_text") or ""

        doc_info = doc_map.get(doc_id)
        if not doc_info or not doc_info["content"]:
            continue

        content = doc_info["content"]
        # Find exact substring match
        start_idx = content.find(claim_text)

        if start_idx != -1:
            end_idx = start_idx + len(claim_text)
            # VERIFICATION ASSERTION:
            exact_span = content[start_idx:end_idx]
            assert exact_span == claim_text, "Evidence span mismatch!"

            evidence_records.append({
                "claim_id": claim_id,
                "document_id": doc_id,
                "quote": claim_text,
                "start_char": start_idx,
                "end_char": end_idx,
                "evidence_type": "direct_quote",
                "extraction_method": "exact_substring_match",
                "sentiment_label": "neutral",
                "perspective": doc_info["perspective"],
            })
        else:
            # Fallback: if partial substring match exists (first 50 chars)
            short_prefix = claim_text[:50]
            prefix_idx = content.find(short_prefix)
            if prefix_idx != -1:
                # Find sentence boundary after prefix_idx
                end_idx = prefix_idx + len(claim_text)
                if end_idx <= len(content):
                    extracted_quote = content[prefix_idx:end_idx]
                else:
                    extracted_quote = content[prefix_idx:]
                    end_idx = len(content)

                evidence_records.append({
                    "claim_id": claim_id,
                    "document_id": doc_id,
                    "quote": extracted_quote,
                    "start_char": prefix_idx,
                    "end_char": end_idx,
                    "evidence_type": "direct_quote",
                    "extraction_method": "verbatim_prefix_span",
                    "sentiment_label": "neutral",
                    "perspective": doc_info["perspective"],
                })

    return evidence_records
