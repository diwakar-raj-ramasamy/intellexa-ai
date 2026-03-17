const $ = (id) => document.getElementById(id);

function safeText(el, text) {
  if (!el) return;
  el.textContent = text ?? "";
}

function parseJsonSafely(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function nowIso() {
  return new Date().toISOString();
}

const STORAGE_KEY = "intellexa_docs_v1";
const PROFILE_KEY = "intellexa_profile_v1";
const AUTH_KEY = "intellexa_auth_v1";
const THEME_KEY = "intellexa_theme_v1";
const NOTIF_KEY = "intellexa_notifications_v1";
const TOPK_KEY = "intellexa_default_topk_v1";
let lastAppliedTopK = null;

function loadDefaultTopK() {
  const n = Number(localStorage.getItem(TOPK_KEY) || 3);
  if (!Number.isFinite(n)) return 3;
  return Math.min(10, Math.max(1, Math.round(n)));
}

function applyDefaultTopK(force = false) {
  const el = $("topK");
  if (!el) return;
  // Don't overwrite while user is editing.
  if (!force && document.activeElement === el) return;

  const desired = loadDefaultTopK();
  const current = Number(el.value || 0);
  const currentOk = Number.isFinite(current) && current >= 1 && current <= 10;

  // Update if empty/invalid OR it matches what we last applied (meaning user didn't override it).
  if (!currentOk || current === lastAppliedTopK || force) {
    el.value = String(desired);
    lastAppliedTopK = desired;
  }
}

function loadNotifications() {
  const raw = localStorage.getItem(NOTIF_KEY);
  const list = parseJsonSafely(raw);
  return Array.isArray(list) ? list : [];
}

function saveNotifications(list) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(list));
}

function addNotification({ type, title, message }) {
  const list = loadNotifications();
  list.unshift({
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    ts: Date.now(),
    type: type || "info", // info | success | warning | error | progress
    title: title || "Notification",
    message: message || "",
    read: false,
  });
  saveNotifications(list.slice(0, 50));
  renderNotificationsUI();
}

function markAllNotificationsRead() {
  const list = loadNotifications().map((n) => ({ ...n, read: true }));
  saveNotifications(list);
  renderNotificationsUI();
}

function deleteNotificationById(id) {
  if (!id) return;
  const next = loadNotifications().filter((n) => n.id !== id);
  saveNotifications(next);
  renderNotificationsUI();
}

function timeAgo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - Number(ts || 0)) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function renderNotificationsUI() {
  const listEl = $("notificationsList");
  const dot = $("notificationsDot");
  if (!listEl || !dot) return;

  const list = loadNotifications();
  // Only show "completed" notifications in the dropdown (not progress spam)
  const completed = list.filter((n) => n.type !== "progress");
  const unread = completed.some((n) => !n.read);
  dot.classList.toggle("hidden", !unread);

  if (!completed.length) {
    listEl.innerHTML = `
      <div class="p-4 text-sm text-slate-600 dark:text-slate-400">
        No notifications yet.
      </div>
    `;
    return;
  }

  const iconFor = (t) => {
    if (t === "success") return "ph-check-circle";
    if (t === "error") return "ph-x-circle";
    if (t === "warning") return "ph-warning-circle";
    if (t === "progress") return "ph-spinner-gap";
    return "ph-info";
  };
  const colorFor = (t) => {
    if (t === "success") return "text-emerald-600";
    if (t === "error") return "text-rose-600";
    if (t === "warning") return "text-amber-600";
    if (t === "progress") return "text-brand-600";
    return "text-slate-600";
  };

  listEl.innerHTML = completed
    .slice(0, 5)
    .map((n) => {
      const unreadClass = n.read ? "" : "bg-brand-50/40 dark:bg-slate-800/40";
      const title = escapeHtml(n.title || "");
      const msg = escapeHtml(n.message || "");
      return `
        <div class="border-b border-slate-100 px-4 py-3 dark:border-slate-800 ${unreadClass}" data-notif-id="${escapeHtml(
          n.id
        )}">
          <div class="flex items-start gap-3">
            <div class="mt-0.5 ${colorFor(n.type)}">
              <i class="ph ${iconFor(n.type)} text-lg ${n.type === "progress" ? "animate-spin" : ""}"></i>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <div class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">${title}</div>
                <div class="flex items-center gap-2">
                  <div class="shrink-0 text-xs text-slate-500 dark:text-slate-400">${timeAgo(n.ts)}</div>
                  <button
                    type="button"
                    class="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label="Delete notification"
                    title="Delete"
                    data-action="delete-notification"
                    data-id="${escapeHtml(n.id)}"
                  >
                    <i class="ph ph-trash text-base"></i>
                  </button>
                </div>
              </div>
              <div class="mt-1 text-sm text-slate-600 dark:text-slate-400">${msg}</div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function openNotificationsMenu() {
  const menu = $("notificationsMenu");
  if (!menu) return;
  menu.classList.remove("hidden");
  renderNotificationsUI();
}

function closeNotificationsMenu() {
  const menu = $("notificationsMenu");
  if (!menu) return;
  menu.classList.add("hidden");
}

function toggleNotificationsMenu() {
  const menu = $("notificationsMenu");
  if (!menu) return;
  const open = !menu.classList.contains("hidden");
  if (open) closeNotificationsMenu();
  else openNotificationsMenu();
}

function applyThemeFromStorage() {
  try {
    const c = localStorage.getItem(THEME_KEY) || "system";
    const dark =
      c === "dark" ||
      (c === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch {}
}

function getAccessToken() {
  const raw = localStorage.getItem(AUTH_KEY);
  const s = parseJsonSafely(raw) || {};
  return s?.access_token || "";
}

function authHeaders() {
  const token = getAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function isSignedIn() {
  const raw = localStorage.getItem(AUTH_KEY);
  const s = parseJsonSafely(raw) || {};
  return Boolean(s && s.ok);
}

function loadProfile() {
  const raw = localStorage.getItem(PROFILE_KEY);
  const p = parseJsonSafely(raw) || {};
  return {
    name: p.name || "Alex Sterling",
    email: p.email || "",
  };
}

function applyProfileBadge() {
  const btn = $("profileBtn");
  if (!btn) return;
  const p = loadProfile();
  const title = p.email ? `${p.name} • ${p.email}` : p.name;
  btn.title = title;
  btn.setAttribute("aria-label", `Profile: ${title}`);
}

function applyAuthUI() {
  const signedIn = isSignedIn();
  const signInBtn = $("signInBtn");
  const profileBtn = $("profileBtn");

  // `sm:inline-flex` overrides base `hidden` at sm+, so we must also hide at sm breakpoint.
  if (signInBtn) {
    signInBtn.classList.toggle("sm:hidden", signedIn);
  }
  if (profileBtn) profileBtn.setAttribute("href", signedIn ? "/static/profile.html" : "/static/auth.html");
  applyProfileBadge();
}

function loadDocs() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed = parseJsonSafely(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function saveDocs(docs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
}

function classifyFiletype(extOrDot) {
  const t = String(extOrDot || "").toLowerCase();
  if (t.includes("pdf")) return "pdf";
  if (t.includes("md") || t.includes("markdown")) return "markdown";
  if (t.includes("docx") || t.includes("word")) return "docx";
  if (t.includes("json")) return "json";
  if (t.includes("txt")) return "txt";
  return "other";
}

function mimeFromFile(file) {
  if (file?.type) return file.type;
  const ext = String(file?.name || "").split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "json") return "application/json";
  if (ext === "md") return "text/markdown";
  if (ext === "txt") return "text/plain";
  return "application/octet-stream";
}

function prettyType(typeKey) {
  const m = { pdf: "PDF", markdown: "Markdown", docx: "DOCX", json: "JSON", txt: "Text", other: "Other" };
  return m[typeKey] || "Other";
}

function badgeClasses(status) {
  if (status === "indexed") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "vectorizing") return "bg-brand-50 text-brand-700 ring-brand-200";
  if (status === "failed") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-50 text-slate-700 ring-slate-200";
}

function shortId() {
  const s = Math.random().toString(16).slice(2, 10).toUpperCase();
  return `${s.slice(0, 4)}-${s.slice(4, 7)}`;
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const mb = n / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = n / 1024;
  return `${Math.max(1, Math.round(kb))} KB`;
}

function formatDateTwoLine(iso) {
  if (!iso) return { date: "—", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: String(iso), time: "" };
  const date = d.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return { date, time };
}

function iconForType(typeKey) {
  const t = String(typeKey || "");
  if (t === "pdf") return "ph-file-pdf";
  if (t === "docx") return "ph-file-doc";
  if (t === "markdown") return "ph-file-text";
  if (t === "json") return "ph-brackets-curly";
  if (t === "txt") return "ph-file-text";
  return "ph-file";
}

function withinTimeRange(iso, range) {
  if (!range || range === "all") return true;
  const d = new Date(iso || 0);
  if (Number.isNaN(d.getTime())) return true;
  const ms = Date.now() - d.getTime();
  if (range === "24h") return ms <= 24 * 60 * 60 * 1000;
  if (range === "7d") return ms <= 7 * 24 * 60 * 60 * 1000;
  if (range === "30d") return ms <= 30 * 24 * 60 * 60 * 1000;
  return true;
}

const FILTER_KEY = "intellexa_time_range_v1";

function getTimeRange() {
  return localStorage.getItem(FILTER_KEY) || "24h";
}

function setTimeRange(v) {
  localStorage.setItem(FILTER_KEY, v);
}

function setProcessing(state, hint) {
  safeText($("processingState"), state);
  safeText($("processingHint"), hint);
}

function openModal() {
  const m = $("uploadModal");
  if (!m) return;
  m.classList.remove("hidden");
  m.classList.add("flex");
  $("fileInput")?.focus?.();
}

function closeModal() {
  const m = $("uploadModal");
  if (!m) return;
  m.classList.add("hidden");
  m.classList.remove("flex");
  safeText($("uploadStatus"), "");
  if ($("fileInput")) $("fileInput").value = "";
}

function setHealth(ok, hasIndex) {
  const dot = $("healthDot");
  const text = $("healthText");
  if (!dot || !text) return;

  if (!ok) {
    dot.className = "inline-block h-2 w-2 rounded-full bg-rose-500";
    safeText(text, "API: Unreachable");
    return;
  }
  dot.className = hasIndex
    ? "inline-block h-2 w-2 rounded-full bg-emerald-500"
    : "inline-block h-2 w-2 rounded-full bg-amber-500";
  safeText(text, hasIndex ? "API: OK • Index: Loaded" : "API: OK • Index: Empty");
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

function renderDocsTable(activeTab) {
  closeAllDocMenus?.();
  const tbody = $("docsTableBody");
  const empty = $("docsEmptyState");
  if (!tbody) return;

  const all = loadDocs();
  const searchQuery = ($("docsSearch")?.value || "").trim().toLowerCase();
  const range = getTimeRange();
  const filtered = all.filter((d) => {
    if (!activeTab || activeTab === "all") return true;
    return d.type === activeTab;
  }).filter((d) => {
    return withinTimeRange(d.created_at, range);
  }).filter((d) => {
    if (!searchQuery) return true;
    return String(d.name || "").toLowerCase().includes(searchQuery);
  });

  tbody.innerHTML = "";

  if (!filtered.length) {
    if (empty) empty.classList.remove("hidden");
    return;
  }
  if (empty) empty.classList.add("hidden");

  for (const doc of filtered) {
    const tr = document.createElement("tr");

    const fileTd = document.createElement("td");
    fileTd.className = "py-4 pr-6";
    const fileIcon = iconForType(doc.type);
    fileTd.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200">
          <i class="ph ${fileIcon} text-lg"></i>
        </div>
        <div class="min-w-0">
          <div class="truncate font-semibold text-slate-900 dark:text-slate-100">${escapeHtml(doc.name || "Untitled")}</div>
          <div class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">ID: ${escapeHtml(doc.short_id || "—")}</div>
        </div>
      </div>
    `;

    const statusTd = document.createElement("td");
    statusTd.className = "py-4 pr-6";
    if (doc.status === "vectorizing") {
      const pct = Math.min(100, Math.max(0, Number(doc.progress ?? 0)));
      statusTd.innerHTML = `
        <div class="flex flex-col gap-2">
          <div class="text-[11px] font-bold uppercase tracking-wider text-brand-600">Vectorizing…</div>
          <div class="flex items-center gap-3">
            <div class="h-2 w-40 rounded-full bg-slate-100">
              <div class="h-2 rounded-full bg-brand-500" style="width:${pct}%"></div>
            </div>
            <div class="text-xs font-semibold text-slate-600">${pct}%</div>
          </div>
        </div>
      `;
    } else {
      const label = doc.status === "indexed" ? "INDEXED" : doc.status === "failed" ? "FAILED" : "—";
      statusTd.innerHTML = `
        <span class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 ring-inset ${badgeClasses(
          doc.status
        )}">
          ${escapeHtml(label)}
        </span>
      `;
    }

    const sizeTd = document.createElement("td");
    sizeTd.className = "py-4 pr-6";
    sizeTd.innerHTML = `
      <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">${escapeHtml(formatBytes(doc.size_bytes))}</div>
      <div class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">${escapeHtml(doc.mime || prettyType(doc.type))}</div>
    `;

    const dateTd = document.createElement("td");
    dateTd.className = "py-4 pr-6";
    const dt = formatDateTwoLine(doc.created_at);
    dateTd.innerHTML = `
      <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">${escapeHtml(dt.date)}</div>
      <div class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">${escapeHtml(dt.time)}</div>
    `;

    const actionsTd = document.createElement("td");
    actionsTd.className = "py-4 pr-0 text-right";
    actionsTd.innerHTML = `
      <button
        type="button"
        class="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
        aria-label="Actions"
        data-action="open-actions"
        data-docid="${escapeHtml(doc.id)}"
        title="Actions"
      >
        <i class="ph ph-dots-three-vertical text-xl"></i>
      </button>
    `;

    tr.appendChild(fileTd);
    tr.appendChild(statusTd);
    tr.appendChild(sizeTd);
    tr.appendChild(dateTd);
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  }
}

function closeAllDocMenus() {
  const menu = $("globalActionsMenu");
  if (!menu) return;
  menu.classList.add("hidden");
  menu.dataset.docid = "";
}

function closeFilterMenu() {
  const m = $("globalFilterMenu");
  if (!m) return;
  m.classList.add("hidden");
}

function ensureGlobalFilterMenu() {
  if ($("globalFilterMenu")) return;
  const m = document.createElement("div");
  m.id = "globalFilterMenu";
  m.className =
    "fixed z-[80] hidden w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900";
  m.innerHTML = `
    <div class="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Date added</div>
    <button type="button" class="flex w-full items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800" data-range="24h">
      <span>Last 24 Hours</span>
      <span class="hidden text-brand-600" data-check="24h"><i class="ph ph-check text-base"></i></span>
    </button>
    <button type="button" class="flex w-full items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800" data-range="7d">
      <span>Last 7 Days</span>
      <span class="hidden text-brand-600" data-check="7d"><i class="ph ph-check text-base"></i></span>
    </button>
    <button type="button" class="flex w-full items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800" data-range="30d">
      <span>Last 30 Days</span>
      <span class="hidden text-brand-600" data-check="30d"><i class="ph ph-check text-base"></i></span>
    </button>
    <button type="button" class="flex w-full items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800" data-range="all">
      <span>All time</span>
      <span class="hidden text-brand-600" data-check="all"><i class="ph ph-check text-base"></i></span>
    </button>
  `;
  document.body.appendChild(m);
}

function syncFilterMenuChecks() {
  const m = $("globalFilterMenu");
  if (!m) return;
  const v = getTimeRange();
  m.querySelectorAll("[data-check]").forEach((el) => el.classList.add("hidden"));
  const check = m.querySelector(`[data-check="${CSS.escape(v)}"]`);
  if (check) check.classList.remove("hidden");
}

function openFilterMenu(anchorEl) {
  const m = $("globalFilterMenu");
  if (!m || !anchorEl) return;
  syncFilterMenuChecks();
  const r = anchorEl.getBoundingClientRect();
  const margin = 8;
  const menuW = 224; // ~w-56
  const menuH = 210;

  let left = Math.min(window.innerWidth - menuW - margin, r.right - menuW);
  left = Math.max(margin, left);

  let top = r.bottom + 8;
  if (top + menuH + margin > window.innerHeight) {
    top = Math.max(margin, r.top - menuH - 8);
  }

  m.style.left = `${Math.round(left)}px`;
  m.style.top = `${Math.round(top)}px`;
  m.classList.remove("hidden");
}

function ensureGlobalActionsMenu() {
  if ($("globalActionsMenu")) return;
  const menu = document.createElement("div");
  menu.id = "globalActionsMenu";
  menu.className =
    "fixed z-[80] hidden w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900";
  menu.innerHTML = `
    <button
      type="button"
      class="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
      data-action="remove-doc"
      role="menuitem"
    >
      <i class="ph ph-trash text-base text-slate-500"></i>
      Remove
    </button>
  `;
  document.body.appendChild(menu);
}

function openGlobalActionsMenu(anchorEl, docId) {
  const menu = $("globalActionsMenu");
  if (!menu || !anchorEl) return;
  menu.dataset.docid = docId || "";

  const r = anchorEl.getBoundingClientRect();
  const margin = 8;
  const menuW = 176; // ~w-44
  const menuH = 44; // single row

  let left = Math.min(window.innerWidth - menuW - margin, r.right - menuW);
  left = Math.max(margin, left);

  let top = r.bottom + 8;
  if (top + menuH + margin > window.innerHeight) {
    top = Math.max(margin, r.top - menuH - 8);
  }

  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
  menu.classList.remove("hidden");
}

function wireDocsTableInteractions() {
  const tbody = $("docsTableBody");
  if (!tbody) return;

  // Avoid stacking duplicate listeners across rerenders
  if (tbody.dataset.wired === "1") return;
  tbody.dataset.wired = "1";

  tbody.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    if (action === "open-actions") {
      const id = btn.dataset.docid || "";
      closeAllDocMenus();
      openGlobalActionsMenu(btn, id);
      return;
    }
  });

  document.addEventListener("click", (e) => {
    const menu = $("globalActionsMenu");
    if (!menu) return;
    const clickedActionsBtn = e.target?.closest?.('button[data-action="open-actions"]');
    const clickedInsideMenu = e.target?.closest?.("#globalActionsMenu");
    if (!clickedActionsBtn && !clickedInsideMenu) closeAllDocMenus();
  });

  document.addEventListener("click", (e) => {
    const removeBtn = e.target?.closest?.('#globalActionsMenu button[data-action="remove-doc"]');
    if (!removeBtn) return;
    const menu = $("globalActionsMenu");
    const id = menu?.dataset?.docid || "";
    if (!id) return;
    closeAllDocMenus();
    const next = loadDocs().filter((d) => d.id !== id);
    saveDocs(next);
    updateCards();
    renderSearchOptions();
    setSearchClearVisible();
    renderDocsTable(getActiveTab());
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllDocMenus();
  });

  window.addEventListener("scroll", () => closeAllDocMenus(), true);
  window.addEventListener("resize", () => closeAllDocMenus());
}

function updateCards() {
  const docs = loadDocs();
  safeText($("totalDocs"), String(docs.length));
  safeText($("docsDelta"), docs.length ? "Indexed documents" : "Ready");
}

function renderSearchOptions() {
  const list = $("docsSearchList");
  if (!list) return;
  const docs = loadDocs();
  const names = Array.from(new Set(docs.map((d) => String(d.name || "")).filter(Boolean)));
  list.innerHTML = "";
  for (const name of names) {
    const opt = document.createElement("option");
    opt.value = name;
    list.appendChild(opt);
  }
}

function setSearchClearVisible() {
  const clearBtn = $("docsSearchClear");
  const hasValue = Boolean(($("docsSearch")?.value || "").trim());
  if (!clearBtn) return;
  clearBtn.classList.toggle("hidden", !hasValue);
  clearBtn.classList.toggle("inline-flex", hasValue);
}

function renderChunks(chunks = []) {
  const root = $("chunks");
  if (!root) return;
  root.innerHTML = "";

  if (!chunks.length) {
    const empty = document.createElement("div");
    empty.className = "rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600";
    empty.textContent = "No chunks retrieved.";
    root.appendChild(empty);
    return;
  }

  chunks.forEach((c, idx) => {
    const m = c.metadata || {};
    const wrap = document.createElement("div");
    wrap.className = "rounded-xl border border-slate-200 bg-white p-3";
    wrap.innerHTML = `
      <div class="text-xs font-semibold text-slate-700">
        #${idx + 1} • source=${escapeHtml(m.source ?? "?")} • page=${escapeHtml(m.page ?? "?")}
      </div>
      <div class="mt-2 whitespace-pre-wrap text-sm text-slate-800">${escapeHtml(
        String(c.page_content || "").slice(0, 1400)
      )}</div>
    `;
    root.appendChild(wrap);
  });
}

function setLoading(btn, loading, workingText = "Working…") {
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? workingText : btn.dataset.label;
}

async function uploadFile() {
  const input = $("fileInput");
  const file = input?.files?.[0];
  if (!file) {
    safeText($("uploadStatus"), "Pick a file first.");
    return;
  }

  await uploadFileFromPicker(file, { statusElId: "uploadStatus", closeOnSuccess: true });
}

async function uploadFileFromPicker(file, { statusElId, closeOnSuccess } = {}) {
  const statusEl = statusElId ? $(statusElId) : null;
  const btn = $("uploadBtn");
  if (btn) btn.dataset.label = btn.dataset.label || "Upload & Index";

  addNotification({
    type: "progress",
    title: "File processing",
    message: `Uploading “${file.name}”…`,
  });

  setProcessing("Uploading", "Indexing in progress…");
  setLoading(btn, true);
  if (statusEl) safeText(statusEl, "Uploading and indexing…");

  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const type = classifyFiletype(ext);
  const docs = loadDocs();
  const docId = `${file.name}:${nowIso()}`;
  const sid = shortId();
  docs.unshift({
    id: docId,
    short_id: sid,
    name: file.name,
    type,
    status: "vectorizing",
    chunks_added: null,
    size_bytes: file.size ?? null,
    mime: mimeFromFile(file),
    progress: 5,
    created_at: nowIso(),
  });
  saveDocs(docs);
  updateCards();
  renderSearchOptions();
  setSearchClearVisible();
  renderDocsTable(getActiveTab());

  try {
    // Simulate progress while the backend is indexing.
    const milestones = new Set([25, 50, 75]);
    const progressTimer = window.setInterval(() => {
      const current = loadDocs();
      const next = current.map((d) => {
        if (d.id !== docId) return d;
        if (d.status !== "vectorizing") return d;
        const p = Number(d.progress ?? 0);
        const base = Number.isFinite(p) ? p : 10;
        const bumped = Math.min(90, Math.max(base, base + Math.ceil(Math.random() * 7)));
        return { ...d, progress: bumped };
      });
      saveDocs(next);
      renderDocsTable(getActiveTab());

      // Notify on coarse milestones so we don't spam.
      const me = next.find((d) => d.id === docId);
      const pct = Math.round(Number(me?.progress ?? 0));
      for (const m of [...milestones]) {
        if (pct >= m) {
          milestones.delete(m);
          addNotification({
            type: "progress",
            title: "File processing",
            message: `Vectorizing “${file.name}”… ${m}%`,
          });
        }
      }
    }, 650);

    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/upload", { method: "POST", headers: authHeaders(), body: form });
    const raw = await res.text();
    const data = parseJsonSafely(raw) || { detail: raw };
    if (!res.ok) throw new Error(data.detail || "Upload failed");

    window.clearInterval(progressTimer);

    const updated = loadDocs().map((d) => {
      if (d.id !== docId) return d;
      return {
        ...d,
        status: "indexed",
        chunks_added: data.chunks_added ?? null,
        type: classifyFiletype(data.filetype || type),
        progress: 100,
      };
    });
    saveDocs(updated);

    if (statusEl) {
      safeText(
        statusEl,
        `Indexed ${data.chunks_added} chunks (${String(data.filetype || type).toUpperCase()}).`
      );
    }

    addNotification({
      type: "success",
      title: "File uploaded",
      message: `“${file.name}” uploaded successfully (${data.chunks_added} chunks).`,
    });

    setProcessing("Done", "No active jobs");
    await refreshHealth();
    updateCards();
    renderSearchOptions();
    setSearchClearVisible();
    renderDocsTable(getActiveTab());

    if (closeOnSuccess) {
      // close after a short beat so user sees success
      window.setTimeout(closeModal, 500);
    }
  } catch (e) {
    const updated = loadDocs().map((d) =>
      d.id === docId ? { ...d, status: "failed", progress: Math.min(100, Number(d.progress ?? 0) || 0) } : d
    );
    saveDocs(updated);
    updateCards();
    renderSearchOptions();
    setSearchClearVisible();
    renderDocsTable(getActiveTab());

    if (statusEl) safeText(statusEl, `Upload failed: ${e.message}`);
    addNotification({
      type: "error",
      title: "File upload failed",
      message: `“${file.name}” failed: ${e.message}`,
    });
    setProcessing("Error", "No active jobs");
  } finally {
    setLoading(btn, false);
  }
}

async function ask() {
  const queryEl = $("query");
  const query = queryEl?.value?.trim?.() || "";
  if (!query) return;

  const btn = $("askBtn");
  btn.dataset.label = btn.dataset.label || "Ask";
  setLoading(btn, true, "Thinking…");
  safeText($("answer"), "Thinking…");
  setProcessing("Retrieving", "Running multi-agent pipeline…");

  try {
    const topK = Number($("topK")?.value || loadDefaultTopK());
    const res = await fetch("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ query, top_k: topK }),
    });
    const raw = await res.text();
    const data = parseJsonSafely(raw) || { detail: raw };
    if (!res.ok) throw new Error(data.detail || "Ask failed");

    safeText($("flow"), data.agent_flow || "");
    safeText($("confidence"), `${data.confidence ?? 0}%`);
    safeText($("warning"), data.warning ?? "—");
    safeText($("answer"), data.answer ?? "");
    safeText($("sources"), JSON.stringify(data.sources ?? [], null, 2));
    safeText($("trace"), JSON.stringify(data.agent_trace ?? [], null, 2));
    renderChunks(data.retrieved_chunks ?? []);

    safeText($("confidenceCard"), `${data.confidence ?? 0}%`);
    safeText($("confidenceHint"), data.warning ? "Warning present" : "No warnings");
    setProcessing("Idle", "No active jobs");
  } catch (e) {
    safeText($("answer"), `Error: ${e.message}`);
    safeText($("warning"), "—");
    safeText($("confidence"), "—");
    safeText($("sources"), "[]");
    safeText($("trace"), "[]");
    renderChunks([]);
    safeText($("confidenceCard"), "—");
    safeText($("confidenceHint"), "Ask a question to compute.");
    setProcessing("Idle", "No active jobs");
  } finally {
    setLoading(btn, false, "Ask");
  }
}

function setActiveTab(tab) {
  const btns = Array.from(document.querySelectorAll(".tab-btn"));
  for (const b of btns) {
    const isActive = b.dataset.tab === tab;
    b.classList.toggle("text-brand-600", isActive);
    b.classList.toggle("text-slate-500", !isActive);
  }
  sessionStorage.setItem("intellexa_active_tab", tab);
  renderDocsTable(tab);
  updateTabUnderline(tab);
}

function getActiveTab() {
  return sessionStorage.getItem("intellexa_active_tab") || "all";
}

function updateTabUnderline(tab) {
  const underline = $("tabUnderline");
  const row = $("tabsRow");
  if (!underline || !row) return;
  const activeBtn = row.querySelector(`.tab-btn[data-tab="${CSS.escape(tab)}"]`);
  if (!activeBtn) return;

  try {
    activeBtn.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  } catch {
    // ignore
  }

  window.requestAnimationFrame(() => {
    const rowRect = row.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    const left = btnRect.left - rowRect.left + row.scrollLeft;
    underline.style.width = `${Math.max(24, Math.round(btnRect.width))}px`;
    underline.style.transform = `translateX(${Math.round(left)}px)`;
    underline.style.transition = "transform 180ms ease, width 180ms ease";
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

window.addEventListener("DOMContentLoaded", async () => {
  ensureGlobalActionsMenu();
  ensureGlobalFilterMenu();
  applyAuthUI();
  applyThemeFromStorage();
  applyDefaultTopK();
  updateCards();
  renderSearchOptions();
  setSearchClearVisible();
  renderDocsTable(getActiveTab());
  wireDocsTableInteractions();
  safeText($("storageUsed"), "Local");
  $("storageBar")?.setAttribute?.("style", "width: 12%");

  $("closeUploadBtn")?.addEventListener("click", closeModal);
  $("cancelUploadBtn")?.addEventListener("click", closeModal);
  $("uploadModal")?.addEventListener("click", (e) => {
    if (e.target?.id === "uploadModal") closeModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  const uploadBtn = $("uploadBtn");
  if (uploadBtn) {
    uploadBtn.dataset.label = "Upload & Index";
    uploadBtn.addEventListener("click", uploadFile);
  }

  const askBtn = $("askBtn");
  if (askBtn) {
    askBtn.dataset.label = "Ask";
    askBtn.addEventListener("click", ask);
  }
  $("query")?.addEventListener("keydown", (e) => {
    // Enter sends, Shift+Enter makes newline (works for textarea too)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  });

  $("chatUploadBtn")?.addEventListener("click", () => $("chatFileInput")?.click());
  $("chatFileInput")?.addEventListener("change", async (e) => {
    const f = e.target?.files?.[0];
    if (!f) return;
    await uploadFileFromPicker(f, { closeOnSuccess: false });
    e.target.value = "";
  });

  // Notifications UI
  $("notificationsBtn")?.addEventListener("click", (e) => {
    e.stopPropagation?.();
    toggleNotificationsMenu();
  });
  $("notificationsClose")?.addEventListener("click", closeNotificationsMenu);
  $("notificationsMarkRead")?.addEventListener("click", () => markAllNotificationsRead());
  $("notificationsList")?.addEventListener("click", (e) => {
    const btn = e.target?.closest?.('button[data-action="delete-notification"]');
    if (!btn) return;
    deleteNotificationById(btn.dataset.id);
  });
  document.addEventListener("click", (e) => {
    const inside = e.target?.closest?.("#notificationsMenu") || e.target?.closest?.("#notificationsBtn");
    if (!inside) closeNotificationsMenu();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeNotificationsMenu();
  });
  renderNotificationsUI();

  $("composerDocsBtn")?.addEventListener("click", () => {
    const docs = document.getElementById("docsTableBody");
    if (docs) docs.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.addEventListener("click", () => setActiveTab(b.dataset.tab || "all"));
  });
  setActiveTab(getActiveTab());
  window.addEventListener("resize", () => updateTabUnderline(getActiveTab()));

  $("docsSearch")?.addEventListener("input", () => {
    setSearchClearVisible();
    renderDocsTable(getActiveTab());
  });
  $("docsSearchClear")?.addEventListener("click", () => {
    const input = $("docsSearch");
    if (input) input.value = "";
    setSearchClearVisible();
    renderDocsTable(getActiveTab());
    input?.focus?.();
  });

  $("filterBtn")?.addEventListener("click", (e) => {
    closeAllDocMenus();
    const menu = $("globalFilterMenu");
    const isOpen = menu && !menu.classList.contains("hidden");
    closeFilterMenu();
    if (!isOpen) openFilterMenu(e.currentTarget);
  });

  document.addEventListener("click", (e) => {
    const clickedBtn = e.target?.closest?.("#filterBtn");
    const clickedInside = e.target?.closest?.("#globalFilterMenu");
    if (!clickedBtn && !clickedInside) closeFilterMenu();
  });

  document.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("#globalFilterMenu [data-range]");
    if (!btn) return;
    const range = btn.dataset.range || "24h";
    setTimeRange(range);
    closeFilterMenu();
    renderDocsTable(getActiveTab());
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeFilterMenu();
  });

  window.addEventListener("scroll", () => closeFilterMenu(), true);
  window.addEventListener("resize", () => closeFilterMenu());

  window.addEventListener("storage", (e) => {
    if (e.key === AUTH_KEY || e.key === PROFILE_KEY) applyAuthUI();
    if (e.key === THEME_KEY) applyThemeFromStorage();
    if (e.key === TOPK_KEY) applyDefaultTopK();
  });
  // Same-tab updates (Profile -> Home) won't trigger `storage`, so refresh on focus/visibility.
  window.addEventListener("focus", () => applyDefaultTopK(true));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) applyDefaultTopK(true);
  });
  window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", () => {
    if ((localStorage.getItem(THEME_KEY) || "system") === "system") applyThemeFromStorage();
  });

  await refreshHealth();
});