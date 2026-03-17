from __future__ import annotations

import os
import shutil
import tempfile
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.requests import Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import JSONResponse
from pydantic import BaseModel

from agents.analyzer import analyzer_agent
from agents.planner import planner_agent
from agents.responder import response_agent
from agents.retriever import retriever_agent
from agents.validator import validator_agent
from rag.loader import load_and_chunk_file
from rag.vector_store import add_documents, load_vector_store
from utils.serialize import doc_to_dict
from utils.settings import FAISS_DIR, TOP_K


app = FastAPI(title="Intellexa Multi-Agent RAG", version="0.1.0")

static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Ensure frontend always receives JSON (avoid "Unexpected token" in browser).
    return JSONResponse(status_code=500, content={"detail": f"Internal Server Error: {exc}"})


class AskRequest(BaseModel):
    query: str
    top_k: int = TOP_K


class AskResponse(BaseModel):
    answer: str
    confidence: int
    warning: Optional[str] = None
    sources: List[Dict[str, Any]]
    retrieved_chunks: List[Dict[str, Any]]
    agent_flow: str
    agent_trace: List[Dict[str, Any]]


db = load_vector_store()


def run_pipeline(query: str, top_k: int = TOP_K) -> Dict[str, Any]:
    if db is None:
        raise HTTPException(
            status_code=400,
            detail="Vector store is empty. Upload at least one PDF first via /upload.",
        )

    agent_trace: List[Dict[str, Any]] = []

    plan = planner_agent(query)
    agent_trace.append({"agent": "planner", "output": plan})

    retrieved = retriever_agent(db, plan["query"], k=top_k)
    docs = retrieved["docs"]
    scores = retrieved["scores"]
    agent_trace.append(
        {
            "agent": "retriever",
            "output": {
                "k": top_k,
                "num_docs": len(docs),
                "scores": scores,
            },
        }
    )

    answer = analyzer_agent(query, docs)
    agent_trace.append({"agent": "analyzer", "output": {"answer_preview": answer[:240]}})

    validation = validator_agent(answer, docs, scores)
    agent_trace.append({"agent": "validator", "output": validation})

    final = response_agent(answer, validation)
    agent_trace.append({"agent": "responder", "output": {"confidence": final["confidence"]}})

    retrieved_chunks = []
    sources = []
    for doc in docs:
        d = doc_to_dict(doc)
        retrieved_chunks.append(d)
        sources.append(d.get("metadata", {}))

    return {
        "answer": final["answer"],
        "confidence": final["confidence"],
        "warning": final.get("warning"),
        "sources": sources,
        "retrieved_chunks": retrieved_chunks,
        "agent_flow": "[Planner] → [Retriever] → [Analyzer] → [Validator] → [Responder]",
        "agent_trace": agent_trace,
    }


@app.get("/")
def index():
    index_path = os.path.join(static_dir, "index.html")
    if not os.path.isfile(index_path):
        raise HTTPException(status_code=404, detail="UI not found.")
    return FileResponse(index_path)


@app.get("/health")
def health():
    return {"ok": True, "has_index": os.path.isdir(FAISS_DIR)}


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    global db

    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename.")

    allowed = {".pdf", ".docx", ".json", ".txt", ".md"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(sorted(allowed))}",
        )

    with tempfile.TemporaryDirectory() as tmpdir:
        file_path = os.path.join(tmpdir, file.filename)
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        try:
            chunks = load_and_chunk_file(file_path)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        if not chunks:
            raise HTTPException(status_code=400, detail="Could not extract text from this file.")

        try:
            db = add_documents(db, chunks)
        except RuntimeError as e:
            raise HTTPException(status_code=400, detail=str(e))

    return {"ok": True, "chunks_added": len(chunks), "filetype": ext}


@app.post("/ask", response_model=AskResponse)
def ask(payload: AskRequest):
    result = run_pipeline(payload.query, top_k=payload.top_k)
    return result

