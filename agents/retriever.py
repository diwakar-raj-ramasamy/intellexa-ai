from __future__ import annotations

from typing import Any, Dict, List

from langchain_core.documents import Document

from rag.vector_store import similarity_search_with_scores
from utils.settings import TOP_K


def retriever_agent(db, query: str, k: int = TOP_K) -> Dict[str, Any]:
    pairs = similarity_search_with_scores(db, query, k=k)
    docs: List[Document] = [d for (d, _score) in pairs]
    scores: List[float] = [float(_score) for (_d, _score) in pairs]
    return {"docs": docs, "scores": scores}

