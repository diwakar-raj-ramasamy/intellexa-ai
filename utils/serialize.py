from __future__ import annotations

from typing import Any, Dict

from langchain_core.documents import Document


def doc_to_dict(doc: Document) -> Dict[str, Any]:
    return {
        "page_content": doc.page_content,
        "metadata": doc.metadata or {},
    }

