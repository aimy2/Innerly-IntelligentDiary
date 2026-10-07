import json

import httpx

from .config import get_settings

SYSTEM_PROMPT = """You are Innerly, a thoughtful friend who reads between the lines of a private journal entry. Sound human, warm, curious, and specific, never like a therapist report or an AI summary. Return JSON with: title (a creative short title, 3-7 words), insight (one vivid sentence that notices the emotional thread), reflection (2-4 sentences, like a friend thinking beside the writer: use a concrete image or memorable phrase, then gently name a tension, assumption, blind spot, or uncomfortable question; it must be kind but not merely positive), goal (one small practical goal), and tags (2-4 lowercase words). Do not diagnose, flatter, or use generic wellness clichés."""


def _fallback(content: str) -> tuple[str, str, str, str, list[str]]:
    words = len(content.split())
    title = "A moment worth keeping"
    insight = f"You gave yourself room to notice what is happening; this entry holds {words} words of honest signal."
    excerpt = " ".join(content.split()[:10])
    reflection = f"Your note keeps circling \"{excerpt}\". It may be worth asking what you are protecting here, and whether that protection is still helping or has quietly become a locked door. What would change if you let yourself answer that honestly?"
    return title, insight, reflection, "Name one assumption to test before taking your next step.", ["self-awareness", "daily check-in"]


async def analyze_entry(content: str) -> tuple[str, str, str, str, list[str]]:
    settings = get_settings()
    if not settings.llm_api_key:
        return _fallback(content)
    payload = {
        "model": settings.llm_model,
        "temperature": 0.6,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": content}],
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{settings.llm_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {settings.llm_api_key}"}, json=payload,
            )
            response.raise_for_status()
            result = json.loads(response.json()["choices"][0]["message"]["content"])
            return result.get("title", "A moment worth keeping"), result["insight"], result["reflection"], result.get("goal", "Choose one small action that supports what matters here."), result.get("tags", [])[:4]
    except (httpx.HTTPError, KeyError, IndexError, json.JSONDecodeError):
        return _fallback(content)


async def daily_context(entries: list) -> tuple[str, str, str]:
    settings = get_settings()
    if not settings.llm_api_key:
        if not entries:
            return "You are beginning with openness today. Let one honest sentence be enough.", "The present moment is the only time over which we have dominion.", "Thich Nhat Hanh"
        moods = ", ".join(entry.mood for entry in entries[:3])
        return f"Your recent notes carry a {moods} energy. You seem to be paying attention; keep following the thread that feels most honest.", "Even in the smallest moment, there is a direction worth noticing.", "Innerly"
    context = "\n".join(f"{entry.title} ({entry.mood}): {entry.content[:240]}" for entry in entries[:8]) or "No entries yet."
    payload = {
        "model": settings.llm_model,
        "temperature": 0.7,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "You are a thoughtful journaling companion. Return JSON with assessment (one concise personalized observation), quote (a short deep quote about life), and quote_source. The quote may be Japanese or from a world thinker; do not invent a quotation. If uncertain, write an original line and set source to Innerly."},
            {"role": "user", "content": f"Recent private journal notes:\n{context}"},
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{settings.llm_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {settings.llm_api_key}"}, json=payload,
            )
            response.raise_for_status()
            result = json.loads(response.json()["choices"][0]["message"]["content"])
            return result["assessment"], result["quote"], result.get("quote_source", "Innerly")
    except (httpx.HTTPError, KeyError, IndexError, json.JSONDecodeError):
        return await daily_context([])


async def answer_chat(message: str, context: str = "") -> tuple[str, str]:
    settings = get_settings()
    if not settings.llm_api_key:
        return (
            "I hear you. Stay with the part of this that feels most alive, and try naming one thing you need before deciding what to do next.",
            "local reflection mode",
        )
    payload = {
        "model": settings.llm_model,
        "temperature": 0.7,
        "messages": [
            {"role": "system", "content": "You are a thoughtful, concise journaling companion. Reflect what you hear, ask at most one useful question, and never diagnose."},
            {"role": "user", "content": f"Recent journal context:\n{context}\n\nMessage:\n{message}"},
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{settings.llm_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {settings.llm_api_key}"}, json=payload,
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"], "private LLM"
    except (httpx.HTTPError, KeyError, IndexError):
        return await answer_chat(message, "") if context else ("I’m here with you. What part of that feels hardest to put into words?", "local reflection mode")
