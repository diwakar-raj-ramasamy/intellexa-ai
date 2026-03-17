## Intellexa Multi-Agent RAG (Fast Demo)

Production-style **multi-agent RAG** you can demo quickly:

```
User
 ↓
[Planner] → [Retriever] → [Analyzer] → [Validator] → [Responder]
 ↓
Answer + Confidence + Sources + Retrieved Chunks
```

### Features
- **Upload & index**: PDF, Word (`.docx`), JSON, TXT/MD
- **Local Vector DB**: FAISS (persisted under `data/`)
- **Gemini**:
  - Embeddings: auto-picks a working `embedContent` model (default: `models/gemini-embedding-001`)
  - Generation: auto-picks a working `generateContent` model (default: `models/gemini-flash-latest`)
- **UI demo**: Answer, confidence, retrieved chunks, sources, and agent trace

---

### Project structure
```
intellexa-ai/
├── app.py
├── agents/
├── rag/
├── static/            # simple demo UI
├── data/              # FAISS index (gitignored)
├── utils/
├── requirements.txt
└── README.md
```

---

### Requirements
- Python 3.11+
- A Gemini API key

---

### Setup
1) Install dependencies:

```bash
python3 -m pip install --user -r requirements.txt --break-system-packages
```

2) Create `.env` (or edit the existing one):

```env
API_KEY=YOUR_GEMINI_KEY

# Optional overrides
GEMINI_MODEL=models/gemini-flash-latest
GEMINI_EMBED_MODEL=models/gemini-embedding-001
TOP_K=3
CHUNK_SIZE=500
CHUNK_OVERLAP=50
```

> `.env` is gitignored; `.env.example` is safe to commit/share.

---

### Run
```bash
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000
```

Open:
- **UI**: `http://localhost:8000/`
- **API docs**: `http://localhost:8000/docs`

---

### Demo flow (what to show)
1) Upload a document (PDF/DOCX/JSON)
2) Ask a question
3) Show:
   - Answer
   - Confidence
   - Retrieved chunks
   - Sources (metadata)
   - Agent trace

---

### API
- `POST /upload` (multipart form-data)
  - field: `file`
  - returns: `{ ok, chunks_added, filetype }`

- `POST /ask` (JSON)
  - body: `{ "query": "...", "top_k": 3 }`
  - returns: `{ answer, confidence, warning, sources, retrieved_chunks, agent_flow, agent_trace }`

---

### Troubleshooting
- **Upload fails with “model not found”**
  - Your Gemini account may expose different model names.
  - This project auto-selects a compatible model, but you can also set:
    - `GEMINI_MODEL` to a model that supports `generateContent`
    - `GEMINI_EMBED_MODEL` to a model that supports `embedContent`

- **“Vector store is empty”**
  - Upload at least one document first.

- **WSL / pip issues**
  - This project uses `--break-system-packages` because some WSL images ship Python as an externally-managed environment (PEP 668).

---

### Supabase (optional backend integration)
If you enable Supabase, the backend will:
- verify `Authorization: Bearer <token>` (optional; requests can stay anonymous)
- upload raw files to **Supabase Storage**
- store metadata + chat history in **Supabase Postgres**

#### Env
Set in `.env`:

```env
SUPABASE_ENABLED=true
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=uploads

# Optional (recommended): allows local JWT verification
SUPABASE_JWT_SECRET=YOUR_JWT_SECRET
```

#### SQL schema (run once in Supabase SQL editor)
```sql
create table if not exists public.users (
  id text primary key,
  email text,
  last_seen_at timestamptz
);

create table if not exists public.uploads (
  id uuid primary key,
  uid text,
  original_filename text,
  filetype text,
  chunks_added int,
  storage_bucket text,
  storage_path text,
  created_at timestamptz
);

create table if not exists public.chats (
  id uuid primary key,
  uid text,
  upload_id uuid,
  query text,
  answer text,
  confidence int,
  warning text,
  sources jsonb,
  agent_trace jsonb,
  created_at timestamptz
);
```

#### Storage bucket
Create a **Storage bucket** named `uploads` in Supabase:
- Supabase Dashboard → **Storage** → **Create bucket** → name: `uploads`
- Or set `SUPABASE_STORAGE_BUCKET` in `.env` to an existing bucket name.

