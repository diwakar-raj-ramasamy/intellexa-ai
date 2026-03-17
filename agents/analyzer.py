from __future__ import annotations

from typing import List

import google.generativeai as genai
from langchain_core.documents import Document

from utils.settings import GEMINI_API_KEY, GEMINI_MODEL


def _pick_generation_model(preferred: str) -> str:
    try:
        models = list(genai.list_models())
        gen_models = [
            getattr(m, "name", None)
            for m in models
            if getattr(m, "supported_generation_methods", None)
            and "generateContent" in getattr(m, "supported_generation_methods", [])
        ]
        gen_models = [m for m in gen_models if m]
        if preferred in gen_models:
            return preferred
        if gen_models:
            return gen_models[0]
    except Exception:
        pass
    return preferred


def analyzer_agent(query: str, docs: List[Document]) -> str:
    if not docs:
        return "No supporting context was retrieved."
    if not GEMINI_API_KEY:
        return "API_KEY (or GEMINI_API_KEY) is not set, so the Analyzer Agent cannot run."

    context = "\n\n---\n\n".join([doc.page_content for doc in docs])

    prompt = f"""You must answer the question based ONLY on the context.

If the context is insufficient, say you don't know.

Context:
{context}

Question:
{query}
"""

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(_pick_generation_model(GEMINI_MODEL))
    resp = model.generate_content(
        prompt,
        generation_config=genai.types.GenerationConfig(temperature=0.2),
    )

    return (getattr(resp, "text", None) or "").strip()

