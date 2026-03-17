from __future__ import annotations

import os
from typing import Iterable, List, Tuple

from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS

from rag.embedder import get_embeddings
from utils.settings import FAISS_DIR


def load_vector_store() -> FAISS | None:
    if not os.path.isdir(FAISS_DIR):
        return None
    try:
        embeddings = get_embeddings()
        return FAISS.load_local(FAISS_DIR, embeddings, allow_dangerous_deserialization=True)
    except Exception:
        # If embeddings can't be constructed (e.g., missing API key),
        # treat as "no index loaded" and let upload/ask endpoints explain.
        return None


def save_vector_store(db: FAISS) -> None:
    os.makedirs(FAISS_DIR, exist_ok=True)
    db.save_local(FAISS_DIR)


def create_vector_store(docs: Iterable[Document]) -> FAISS:
    embeddings = get_embeddings()
    return FAISS.from_documents(list(docs), embeddings)


def add_documents(db: FAISS | None, docs: List[Document]) -> FAISS:
    try:
        if db is None:
            db = create_vector_store(docs)
        else:
            db.add_documents(docs)
        save_vector_store(db)
        return db
    except Exception as e:
        raise RuntimeError(f"Indexing failed: {e}")


def similarity_search_with_scores(db: FAISS, query: str, k: int) -> List[Tuple[Document, float]]:
    # Score meaning depends on distance strategy; in FAISS+LangChain it's typically smaller=more similar.
    return db.similarity_search_with_score(query, k=k)

