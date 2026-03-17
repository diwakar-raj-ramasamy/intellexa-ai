from __future__ import annotations

from typing import Any, Dict


def response_agent(answer: str, validation: Dict[str, Any]) -> Dict[str, Any]:
    if not validation.get("valid"):
        return {
            "answer": "No supporting data found in the current knowledge base.",
            "confidence": 0,
            "warning": "No sources were retrieved for this question.",
        }

    confidence = int(validation.get("confidence", 0))
    warning = None
    if confidence < 50:
        warning = "This answer may be unreliable (low confidence)."

    return {"answer": answer, "confidence": confidence, "warning": warning}

