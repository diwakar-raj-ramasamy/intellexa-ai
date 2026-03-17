from __future__ import annotations

from typing import Any, Dict, List

from langchain_core.documents import Document


def _score_to_quality(score: float) -> float:
    # LangChain FAISS scores are commonly distances (lower = better).
    # Map to (0..1], where 1 is "very strong match".
    return 1.0 / (1.0 + max(0.0, float(score)))


def validator_agent(answer: str, docs: List[Document], scores: List[float]) -> Dict[str, Any]:
    if not docs:
        return {"valid": False, "confidence": 0, "reason": "no_docs"}

    doc_factor = min(1.0, len(docs) / 3.0)  # 3 docs => full coverage
    if scores:
        avg_quality = sum(_score_to_quality(s) for s in scores) / len(scores)
    else:
        avg_quality = 0.5

    confidence = int(round(100 * (0.55 * doc_factor + 0.45 * avg_quality)))
    confidence = max(0, min(100, confidence))

    # Lightweight hallucination signal: if answer says "don't know" or similar, lower confidence.
    lowered = (answer or "").lower()
    if "don't know" in lowered or "do not know" in lowered or "insufficient" in lowered:
        confidence = min(confidence, 45)

    return {"valid": True, "confidence": confidence, "reason": "ok"}

