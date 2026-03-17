const $ = (id) => document.getElementById(id);

function setText(id, text) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
}

function setHealth(ok, hasIndex) {
  const pill = $("healthPill");
  if (!pill) return;
  pill.classList.remove("ok", "bad");
  if (ok) {
    pill.classList.add("ok");
    pill.textContent = hasIndex ? "API: OK • Index: Loaded" : "API: OK • Index: Empty";
  } else {
    pill.classList.add("bad");
    pill.textContent = "API: Unreachable";
  }
}

async function refreshHealth() {
  try {
    const res = await fetch("/health");
    const data = await res.json();
    setHealth(Boolean(data.ok), Boolean(data.has_index));
  } catch {
    setHealth(false, false);
  }
}

function renderChunks(chunks = []) {
  const root = $("chunks");
  root.innerHTML = "";
  if (!chunks.length) {
    const empty = document.createElement("div");
    empty.className = "subtle";
    empty.textContent = "No chunks retrieved.";
    root.appendChild(empty);
    return;
  }

  chunks.forEach((c, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "chunk";
    const meta = document.createElement("div");
    meta.className = "meta";
    const m = c.metadata || {};
    meta.textContent = `#${idx + 1} • source=${m.source ?? "?"} • page=${m.page ?? "?"}`;
    const text = document.createElement("div");
    text.className = "text";
    text.textContent = (c.page_content || "").slice(0, 1400);
    wrap.appendChild(meta);
    wrap.appendChild(text);
    root.appendChild(wrap);
  });
}

function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.textContent = loading ? "Working…" : btn.dataset.label;
}

async function uploadPdf() {
  const file = $("pdf").files?.[0];
  if (!file) {
    setText("uploadStatus", "Pick a file first.");
    return;
  }

  const btn = $("uploadBtn");
  setLoading(btn, true);
  setText("uploadStatus", "Uploading and indexing…");

  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/upload", { method: "POST", body: form });
    const raw = await res.text();
    let data = {};
    try {
      data = JSON.parse(raw);
    } catch {
      data = { detail: raw };
    }
    if (!res.ok) throw new Error(data.detail || "Upload failed");
    setText("uploadStatus", `Indexed ${data.chunks_added} chunks (${data.filetype || "file"}).`);
    await refreshHealth();
  } catch (e) {
    setText("uploadStatus", `Upload failed: ${e.message}`);
  } finally {
    setLoading(btn, false);
  }
}

async function ask() {
  const query = $("query").value.trim();
  if (!query) return;

  const btn = $("askBtn");
  setLoading(btn, true);
  setText("answer", "Thinking…");

  try {
    const topK = Number($("topK").value || 3);
    const res = await fetch("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, top_k: topK }),
    });
    const raw = await res.text();
    let data = {};
    try {
      data = JSON.parse(raw);
    } catch {
      data = { detail: raw };
    }
    if (!res.ok) throw new Error(data.detail || "Ask failed");

    setText("flow", data.agent_flow || "");
    setText("confidence", `${data.confidence ?? 0}%`);
    setText("warning", data.warning ?? "—");
    setText("answer", data.answer ?? "");
    setText("sources", JSON.stringify(data.sources ?? [], null, 2));
    setText("trace", JSON.stringify(data.agent_trace ?? [], null, 2));
    renderChunks(data.retrieved_chunks ?? []);
  } catch (e) {
    setText("answer", `Error: ${e.message}`);
    setText("warning", "—");
    setText("confidence", "—");
    setText("sources", "[]");
    setText("trace", "[]");
    renderChunks([]);
  } finally {
    setLoading(btn, false);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  $("uploadBtn").dataset.label = "Upload & Index";
  $("askBtn").dataset.label = "Ask";
  $("uploadBtn").addEventListener("click", uploadPdf);
  $("askBtn").addEventListener("click", ask);
  $("query").addEventListener("keydown", (e) => {
    if (e.key === "Enter") ask();
  });
  await refreshHealth();
});

