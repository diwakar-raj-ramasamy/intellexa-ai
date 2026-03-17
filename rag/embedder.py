from __future__ import annotations

from typing import List

import google.generativeai as genai
from langchain_core.embeddings import Embeddings

from utils.settings import GEMINI_API_KEY, GEMINI_EMBED_MODEL


def _pick_embedding_model(preferred: str) -> str:
    # If preferred fails (model not found), fall back to a known-good model for this key.
    try:
        models = list(genai.list_models())
        embed_models = [
            getattr(m, "name", None)
            for m in models
            if getattr(m, "supported_generation_methods", None)
            and "embedContent" in getattr(m, "supported_generation_methods", [])
        ]
        embed_models = [m for m in embed_models if m]
        if preferred in embed_models:
            return preferred
        if embed_models:
            return embed_models[0]
    except Exception:
        pass
    return preferred


class GeminiEmbeddings(Embeddings):
    def __init__(self, api_key: str, model: str):
        genai.configure(api_key=api_key)
        self._model = _pick_embedding_model(model)

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        vectors: List[List[float]] = []
        for t in texts:
            resp = genai.embed_content(
                model=self._model,
                content=t,
                task_type="retrieval_document",
            )
            vectors.append(list(resp["embedding"]))
        return vectors

    def embed_query(self, text: str) -> List[float]:
        resp = genai.embed_content(
            model=self._model,
            content=text,
            task_type="retrieval_query",
        )
        return list(resp["embedding"])


def get_embeddings() -> Embeddings:
    if not GEMINI_API_KEY:
        raise RuntimeError("API_KEY (or GEMINI_API_KEY) is not set; cannot create embeddings.")
    return GeminiEmbeddings(api_key=GEMINI_API_KEY, model=GEMINI_EMBED_MODEL)

