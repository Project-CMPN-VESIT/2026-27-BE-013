import json
import os
import requests

MODELS_DIR = "models"

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL   = "llama-3.3-70b-versatile"


def generate_narrative(topic_key: str,
                       topic_label: str,
                       start_year: int,
                       end_year: int,
                       shifts: dict,
                       sentiment: dict) -> dict:

    slug     = topic_key.replace(" ", "_")
    out_path = f"{MODELS_DIR}/{slug}_{start_year}_{end_year}_narratives.json"

    if os.path.exists(out_path):
        print(f"[Narrative] Loading cached narratives - narrative.py:22")
        with open(out_path) as f:
            return json.load(f)

    years      = shifts.get("years", [])
    shift_data = shifts.get("shifts", {})
    api_key    = os.environ.get("GROQ_API_KEY", "")

    if api_key:
        try:
            prompt = f"""You are an expert media analyst. Based on the semantic shift and sentiment data below for the topic "{topic_label}" from {start_year} to {end_year}, write a one-sentence narrative summary for each year describing what actually changed in media discourse that year.

Shift data (% change in meaning between consecutive years):
{json.dumps(shift_data, indent=2)}

Sentiment data (% positive/negative/neutral per year):
{json.dumps(sentiment, indent=2)}

Return ONLY a valid JSON object with years as string keys and one-sentence summaries as values. No markdown, no explanation, just the raw JSON.
Example: {{"2022": "Coverage shifted toward...", "2023": "Regulation debates dominated..."}}
Keep each summary under 20 words. Be specific and reference real events where the shift data suggests major changes."""

            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type":  "application/json",
            }
            payload = {
                "model":    GROQ_MODEL,
                "messages": [
                    {
                        "role":    "system",
                        "content": "You are a media analysis expert. Always respond with valid JSON only, no markdown."
                    },
                    {
                        "role":    "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.3,
                "max_tokens":  1000,
            }

            r = requests.post(GROQ_API_URL, headers=headers,
                              json=payload, timeout=30)
            r.raise_for_status()
            text = r.json()["choices"][0]["message"]["content"].strip()
            text = text.replace("```json", "").replace("```", "").strip()
            narratives = json.loads(text)
            print(f"[Narrative] Narratives generated via Groq - narrative.py:70")

        except Exception as e:
            print(f"[Narrative] Groq API failed: {e} using smart fallback - narrative.py:73")
            narratives = _smart_fallback(years, shift_data, sentiment)
    else:
        print(f"[Narrative] No GROQ_API_KEY set using smart fallback - narrative.py:76")
        narratives = _smart_fallback(years, shift_data, sentiment)

    with open(out_path, "w") as f:
        json.dump(narratives, f, indent=2)

    return narratives


def _smart_fallback(years: list, shift_data: dict, sentiment: dict) -> dict:
    narratives = {}
    for i, year in enumerate(years):
        shift_val = 0
        if i > 0:
            key       = f"{years[i-1]}-{year}"
            shift_val = shift_data.get(key, 0)

        sent = sentiment.get(str(year), sentiment.get(year, {}))
        pos  = sent.get("positive", 50)
        neg  = sent.get("negative", 25)

        if shift_val > 40:
            intensity = "Major narrative transformation"
        elif shift_val > 25:
            intensity = "Significant narrative shift"
        elif shift_val > 10:
            intensity = "Moderate narrative evolution"
        else:
            intensity = "Stable narrative"

        if pos > 60:
            mood = "with predominantly positive framing"
        elif neg > 40:
            mood = "with predominantly negative and critical coverage"
        elif neg > 25:
            mood = "with mixed but cautious sentiment"
        else:
            mood = "with largely neutral analytical coverage"

        narratives[str(year)] = f"{intensity} in {year} — {mood}."

    return narratives