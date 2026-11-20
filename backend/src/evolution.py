def analyze_narrative_evolution(shifts: dict, sentiment: dict, clusters_data: dict, start_year: int, end_year: int) -> list:
    """
    Analyzes temporal narrative theme transitions across adjacent years.
    Categorizes evolution into: persistent, emerging, disappearing, strengthened, weakened, reframed.
    Preserves similarity scores, shift deltas, and document support counts.
    """
    evolutions = []
    shift_dict = shifts.get("shifts", {})
    years = sorted(list(range(start_year, end_year + 1)))

    for i, yr in enumerate(years):
        if i == 0:
            # Baseline year
            evolutions.append({
                "year": yr,
                "narrative_summary": f"Baseline media coverage established for {yr}.",
                "shift_delta": 0.0,
                "transition_type": "persistent",
                "supporting_data": {
                    "confidence": "baseline",
                    "doc_support": sentiment.get(str(yr), {}).get("total", 0)
                }
            })
            continue

        prev_yr = years[i - 1]
        pair_key = f"{prev_yr}-{yr}"
        shift_val = shift_dict.get(pair_key, 0.0)

        prev_sent = sentiment.get(str(prev_yr), {})
        curr_sent = sentiment.get(str(yr), {})

        curr_pos = curr_sent.get("positive", 50)
        curr_neg = curr_sent.get("negative", 25)
        prev_pos = prev_sent.get("positive", 50)
        prev_neg = prev_sent.get("negative", 25)

        # Categorize transition based on shift delta and sentiment variance
        if shift_val > 30.0:
            if abs(curr_pos - prev_pos) > 20.0 or abs(curr_neg - prev_neg) > 20.0:
                transition = "reframed"
                desc = f"Major narrative reframing between {prev_yr} and {yr} (shift delta: {shift_val}%)."
            else:
                transition = "emerging"
                desc = f"Emerging new narrative topics introduced in {yr} (shift delta: {shift_val}%)."
        elif shift_val > 15.0:
            if curr_pos > prev_pos + 10.0:
                transition = "strengthened"
                desc = f"Narrative strengthened with increased positive focus in {yr} (shift delta: {shift_val}%)."
            elif curr_neg > prev_neg + 10.0:
                transition = "weakened"
                desc = f"Narrative weakened with critical coverage in {yr} (shift delta: {shift_val}%)."
            else:
                transition = "reframed"
                desc = f"Moderate narrative re-alignment observed in {yr} (shift delta: {shift_val}%)."
        else:
            transition = "persistent"
            desc = f"Persistent and stable narrative continuity from {prev_yr} to {yr} (shift delta: {shift_val}%)."

        evolutions.append({
            "year": yr,
            "narrative_summary": desc,
            "shift_delta": float(shift_val),
            "transition_type": transition,
            "supporting_data": {
                "previous_year": prev_yr,
                "current_year": yr,
                "shift_delta": shift_val,
                "prev_sentiment": prev_sent,
                "curr_sentiment": curr_sent,
                "doc_support": curr_sent.get("total", 0),
            }
        })

    return evolutions
