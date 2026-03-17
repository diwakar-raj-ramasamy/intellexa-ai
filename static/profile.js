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

const KEYS = {
  profile: "intellexa_profile_v1",
  auth: "intellexa_auth_v1",
  compact: "intellexa_compact_mode_v1",
  topk: "intellexa_default_topk_v1",
  theme: "intellexa_theme_v1",
  docs: "intellexa_docs_v1",
  convos: "intellexa_ai_conversations_v1",
  activeConvo: "intellexa_ai_active_conversation_v1",
  timeRange: "intellexa_time_range_v1",
};

async function trySupabaseSignOut() {
  try {
    if (!window.supabase?.createClient) return;
    const res = await fetch("/public-config");
    const cfg = await res.json();
    if (!cfg?.supabase_url || !cfg?.supabase_anon_key) return;
    const sb = window.supabase.createClient(cfg.supabase_url, cfg.supabase_anon_key);
    await sb.auth.signOut();
  } catch {
    // ignore
  }
}

function isSignedIn() {
  const raw = localStorage.getItem(KEYS.auth);
  const s = parseJsonSafely(raw) || {};
  return Boolean(s && s.ok);
}

function loadProfile() {
  const raw = localStorage.getItem(KEYS.profile);
  const p = parseJsonSafely(raw) || {};
  return {
    name: p.name || "Alex Sterling",
    role: p.role || "Senior Analyst",
    email: p.email || "",
    password: p.password || "",
  };
}

function saveProfile(p) {
  localStorage.setItem(KEYS.profile, JSON.stringify(p));
}

function setCompactUI(on) {
  const toggle = $("compactToggle");
  const knob = $("compactKnob");
  if (toggle) toggle.setAttribute("aria-pressed", on ? "true" : "false");
  if (toggle) toggle.classList.toggle("bg-brand-500", on);
  if (toggle) toggle.classList.toggle("bg-slate-200", !on);
  if (knob) knob.classList.toggle("translate-x-5", on);
  if (knob) knob.classList.toggle("translate-x-0", !on);
}

function toast(msg) {
  safeText($("statusToast"), msg);
  if (!msg) return;
  window.setTimeout(() => safeText($("statusToast"), ""), 2400);
}

function systemPrefersDark() {
  return Boolean(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

function getThemeChoice() {
  return localStorage.getItem(KEYS.theme) || "system";
}

function applyTheme(choice) {
  const c = choice || "system";
  const isDark = c === "dark" || (c === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", isDark);
}

function setThemeChoice(choice) {
  localStorage.setItem(KEYS.theme, choice);
  applyTheme(choice);
  updateThemeButtons();
}

function updateThemeButtons() {
  const choice = getThemeChoice();
  const map = {
    light: $("themeLight"),
    dark: $("themeDark"),
    system: $("themeSystem"),
  };
  Object.entries(map).forEach(([k, btn]) => {
    if (!btn) return;
    const active = k === choice;
    btn.classList.toggle("bg-white", active);
    btn.classList.toggle("text-slate-900", active);
    btn.classList.toggle("shadow-sm", active);
    btn.classList.toggle("text-slate-600", !active);
  });
}

function setHealth(ok, hasIndex) {
  const dot = $("healthDot");
  const text = $("healthText");
  const kbDot = $("kbDot");
  const kbText = $("kbStatusText");

  const set = (d, t, ok2, has2) => {
    if (!d || !t) return;
    if (!ok2) {
      d.className = "inline-block h-2 w-2 rounded-full bg-rose-500";
      safeText(t, "Disconnected");
      return;
    }
    if (has2) {
      d.className = "inline-block h-2 w-2 rounded-full bg-emerald-500";
      safeText(t, "Connected • Index loaded");
    } else {
      d.className = "inline-block h-2 w-2 rounded-full bg-amber-500";
      safeText(t, "Connected • Index empty");
    }
  };

  set(dot, text, ok, hasIndex);
  set(kbDot, kbText, ok, hasIndex);
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

function applyProfileToUI(p) {
  safeText($("profileNameDisplay"), p.name);
  safeText($("profileRoleDisplay"), p.role);
  if ($("profileNameInput")) $("profileNameInput").value = p.name;
  if ($("profileRoleInput")) $("profileRoleInput").value = p.role;
  if ($("profileEmailInput")) $("profileEmailInput").value = p.email;
  if ($("profilePasswordInput")) $("profilePasswordInput").value = p.password;
}

function wipeLocalData(keys) {
  for (const k of keys) localStorage.removeItem(k);
}

window.addEventListener("DOMContentLoaded", async () => {
  if (!isSignedIn()) {
    window.location.href = "/static/auth.html";
    return;
  }

  applyTheme(getThemeChoice());
  updateThemeButtons();
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  mq?.addEventListener?.("change", () => {
    if (getThemeChoice() === "system") applyTheme("system");
  });

  const profile = loadProfile();
  applyProfileToUI(profile);

  const compactOn = localStorage.getItem(KEYS.compact) === "1";
  setCompactUI(compactOn);

  const topk = Number(localStorage.getItem(KEYS.topk) || 3);
  if ($("defaultTopK")) $("defaultTopK").value = String(Number.isFinite(topk) ? topk : 3);

  $("compactToggle")?.addEventListener("click", () => {
    const on = !($("compactToggle")?.getAttribute("aria-pressed") === "true");
    localStorage.setItem(KEYS.compact, on ? "1" : "0");
    setCompactUI(on);
    toast(on ? "Compact mode enabled." : "Compact mode disabled.");
  });

  $("saveProfileBtn")?.addEventListener("click", () => {
    const next = {
      name: $("profileNameInput")?.value?.trim?.() || "Alex Sterling",
      role: $("profileRoleInput")?.value?.trim?.() || "Senior Analyst",
      email: $("profileEmailInput")?.value?.trim?.() || "",
      password: $("profilePasswordInput")?.value || "",
    };
    saveProfile(next);
    localStorage.setItem(KEYS.topk, String(Number($("defaultTopK")?.value || 3)));
    applyProfileToUI(next);
    toast("Saved.");
  });

  $("themeLight")?.addEventListener("click", () => setThemeChoice("light"));
  $("themeDark")?.addEventListener("click", () => setThemeChoice("dark"));
  $("themeSystem")?.addEventListener("click", () => setThemeChoice("system"));

  $("profilePasswordToggle")?.addEventListener("click", () => {
    const input = $("profilePasswordInput");
    const btn = $("profilePasswordToggle");
    if (!input || !btn) return;
    const icon = btn.querySelector("i");
    const isPw = input.type === "password";
    input.type = isPw ? "text" : "password";
    btn.setAttribute("aria-label", isPw ? "Hide password" : "Show password");
    if (icon) icon.className = isPw ? "ph ph-eye-slash text-lg" : "ph ph-eye text-lg";
  });

  $("signOutBtn")?.addEventListener("click", () => {
    trySupabaseSignOut().finally(() => {
      wipeLocalData([KEYS.auth]);
      window.location.href = "/static/auth.html";
    });
  });

  $("resetLocalBtn")?.addEventListener("click", () => {
    wipeLocalData([KEYS.profile, KEYS.compact, KEYS.topk, KEYS.timeRange, KEYS.theme]);
    applyProfileToUI(loadProfile());
    setCompactUI(false);
    if ($("defaultTopK")) $("defaultTopK").value = "3";
    setThemeChoice("system");
    toast("Local settings cleared.");
  });

  $("wipeAllBtn")?.addEventListener("click", () => {
    wipeLocalData([
      KEYS.profile,
      KEYS.compact,
      KEYS.topk,
      KEYS.timeRange,
      KEYS.theme,
      KEYS.docs,
      KEYS.convos,
      KEYS.activeConvo,
    ]);
    applyProfileToUI(loadProfile());
    setCompactUI(false);
    setThemeChoice("system");
    toast("All local data wiped.");
  });

  await refreshHealth();
});