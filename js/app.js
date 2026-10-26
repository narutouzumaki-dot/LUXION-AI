// LUXION AI - Phase 3
// Login (Supabase Auth) + cloud chat history (Supabase Postgres) + AI chat (Cloudflare Worker -> Gemini).

import { WORKER_URL, MAX_CONTEXT_MESSAGES } from "./config.js";
import * as auth from "./auth.js";
import * as db from "./db.js";

const GREETING = "LUXION online. How can I assist you today?";

// ---- Elements ----
const $ = (id) => document.getElementById(id);
const sidebar = $("sidebar");
const scrim = $("scrim");
const menuBtn = $("menuBtn");
const chat = $("chat");
const input = $("input");
const composer = $("composer");
const sendBtn = $("sendBtn");
const orb = $("orb");
const orbLabel = $("orbLabel");
const notice = $("notice");
const historyList = $("historyList");
const chatTitle = $("chatTitle");
const statusDot = $("statusDot");
const statusText = $("statusText");

const authOverlay = $("authOverlay");
const authTitle = $("authTitle");
const authForm = $("authForm");
const authName = $("authName");
const authEmail = $("authEmail");
const authPass = $("authPass");
const authSubmit = $("authSubmit");
const authMsg = $("authMsg");
const nameRow = $("nameRow");
const emailRow = $("emailRow");
const passRow = $("passRow");
const authTabs = $("authTabs");
const tabLogin = $("tabLogin");
const tabSignup = $("tabSignup");
const forgotBtn = $("forgotBtn");
const backBtn = $("backBtn");

const accountOverlay = $("accountOverlay");
const accEmail = $("accEmail");
const accName = $("accName");
const accMsg = $("accMsg");

// ---- State ----
let user = null;
let displayName = "";
let conversations = []; // { id, title, updated_at, messages: null | [{role, content}] }
let current = null; // same shape; id is null until first reply is saved
let busy = false;
let controller = null;
let recovering = false;
let authMode = "login";

// ---- Helpers ----
function setOrb(state, label) {
  orb.dataset.state = state;
  orb.setAttribute("aria-label", "LUXION AI Core, " + label.toLowerCase());
  orbLabel.textContent = label;
}
function showNotice(text) {
  notice.textContent = text;
  notice.hidden = false;
}
function clearNotice() {
  notice.hidden = true;
  notice.textContent = "";
}
function setBusy(on) {
  busy = on;
  sendBtn.textContent = on ? "Stop" : "Send";
  sendBtn.setAttribute("aria-label", on ? "Stop generating" : "Send message");
}
function setMsg(el, text, kind) {
  el.textContent = text || "";
  el.className = "msg-line" + (kind ? " " + kind : "");
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = "Copied";
  } catch {
    btn.textContent = "Copy failed";
  }
  setTimeout(() => (btn.textContent = "Copy"), 1500);
}

function addBubble(role, text) {
  const div = document.createElement("div");
  div.className = "msg " + role;
  if (role !== "system") {
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = role === "user" ? displayName || "You" : "LUXION";
    div.appendChild(meta);
  }
  const body = document.createElement("div");
  body.textContent = text; // textContent keeps text safe (no HTML injection)
  div.appendChild(body);

  if (role === "ai" && text !== GREETING) {
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "copy-btn";
    copy.textContent = "Copy";
    copy.addEventListener("click", () => copyText(text, copy));
    div.appendChild(copy);
  }
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

// ---- Sidebar history ----
function actionButton(label, text, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "hist-act";
  b.setAttribute("aria-label", label);
  b.title = label;
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}

function renderHistory() {
  historyList.textContent = "";
  if (conversations.length === 0) {
    const p = document.createElement("li");
    p.className = "history-empty";
    p.textContent = user ? "No conversations yet." : "Log in to see your chats.";
    historyList.appendChild(p);
    return;
  }
  for (const c of conversations) {
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className = "hist-row";

    const b = document.createElement("button");
    b.type = "button";
    b.className = "hist-title";
    b.textContent = c.title;
    if (current && c.id === current.id) b.setAttribute("aria-current", "true");
    b.addEventListener("click", () => {
      if (busy) return;
      openConversation(c);
      closeDrawer();
    });

    row.appendChild(b);
    row.appendChild(actionButton("Rename chat", "✎", () => renameChat(c)));
    row.appendChild(actionButton("Delete chat", "\u{1F5D1}", () => deleteChat(c)));
    li.appendChild(row);
    historyList.appendChild(li);
  }
}

async function loadConversations() {
  try {
    const rows = await db.listConversations();
    conversations = rows.map((r) => ({ id: r.id, title: r.title, updated_at: r.updated_at, messages: null }));
  } catch (err) {
    conversations = [];
    showNotice("Could not load your chat history: " + err.message);
  }
  renderHistory();
}

async function openConversation(c) {
  clearNotice();
  chat.textContent = "";
  current = c;
  chatTitle.textContent = c.title;
  setOrb("idle", "Idle");
  renderHistory();
  if (c.messages === null) {
    const loading = addBubble("system", "Loading messages...");
    try {
      const rows = await db.loadMessages(c.id);
      c.messages = rows.map((r) => ({ role: r.role, content: r.content }));
    } catch (err) {
      loading.remove();
      showNotice("Could not load this chat: " + err.message);
      return;
    }
    loading.remove();
  }
  if (current !== c) return; // user switched while loading
  for (const m of c.messages) addBubble(m.role, m.content);
}

async function renameChat(c) {
  if (busy) return;
  const next = window.prompt("Rename chat", c.title);
  if (next === null) return;
  const title = next.trim().slice(0, 100);
  if (!title) return;
  try {
    await db.renameConversation(c.id, title);
    c.title = title;
    if (current === c) chatTitle.textContent = title;
    renderHistory();
  } catch (err) {
    showNotice("Could not rename: " + err.message);
  }
}

async function deleteChat(c) {
  if (busy) return;
  if (!window.confirm('Delete "' + c.title + '"? This cannot be undone.')) return;
  try {
    await db.deleteConversation(c.id);
    conversations = conversations.filter((x) => x !== c);
    if (current === c) startNewChat();
    else renderHistory();
  } catch (err) {
    showNotice("Could not delete: " + err.message);
  }
}

function startNewChat() {
  if (busy && controller) controller.abort();
  current = null;
  chat.textContent = "";
  clearNotice();
  chatTitle.textContent = "New conversation";
  setOrb("idle", "Idle");
  addBubble("ai", GREETING);
  renderHistory();
  input.focus();
}

// ---- Backend status ----
async function checkBackend() {
  statusDot.className = "dot dot-off";
  statusText.textContent = "Backend: checking...";
  try {
    const res = await fetch(WORKER_URL + "/health");
    const data = await res.json();
    if (data.ok && data.keyConfigured && data.modelConfigured) {
      statusDot.className = "dot dot-on";
      statusText.textContent = "Backend: online";
    } else {
      statusText.textContent = "Backend: setup incomplete";
    }
  } catch {
    statusText.textContent = "Backend: unreachable";
  }
}

// ---- Saving to the cloud ----
async function persist(conv, userText, userAt, aiText, aiAt) {
  try {
    if (!conv.id) {
      const row = await db.createConversation(conv.title);
      conv.id = row.id;
      conversations.unshift(conv);
    }
    await db.saveExchange(conv.id, userText, userAt, aiText, aiAt);
    conv.updated_at = aiAt;
    conversations = [conv, ...conversations.filter((x) => x !== conv)];
    renderHistory();
  } catch (err) {
    showNotice("Reply shown, but it could not be saved to the cloud: " + err.message);
  }
}

// ---- Sending ----
async function handleSend(text) {
  if (!user) {
    showAuth("login");
    return;
  }
  if (!current) {
    current = { id: null, title: text.slice(0, 40), updated_at: null, messages: [] };
    chatTitle.textContent = current.title;
  }
  const conv = current;
  const userAt = new Date().toISOString();
  conv.messages.push({ role: "user", content: text });
  addBubble("user", text);

  setBusy(true);
  setOrb("thinking", "Thinking");
  const loading = addBubble("system", "LUXION is thinking...");
  controller = new AbortController();

  const payload = conv.messages.slice(-MAX_CONTEXT_MESSAGES).map((m) => ({ role: m.role, content: m.content }));

  try {
    const session = await auth.getSession();
    if (!session) throw new Error("Your session expired. Please log in again.");

    const res = await fetch(WORKER_URL + "/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + session.access_token
      },
      body: JSON.stringify({ messages: payload }),
      signal: controller.signal
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON response */
    }
    if (!res.ok || !data || !data.reply) {
      throw new Error((data && data.error) || "Request failed (" + res.status + ").");
    }

    loading.remove();
    const aiAt = new Date().toISOString();
    conv.messages.push({ role: "ai", content: data.reply });
    if (current === conv) addBubble("ai", data.reply);
    setOrb("idle", "Idle");
    await persist(conv, text, userAt, data.reply, aiAt);
  } catch (err) {
    loading.remove();
    conv.messages.pop(); // drop the unanswered user message
    if (err.name === "AbortError") {
      addBubble("system", "Generation stopped.");
      setOrb("idle", "Idle");
    } else {
      const msg = err instanceof TypeError ? "Network error: could not reach the backend." : err.message;
      showNotice(msg);
      addBubble("system", msg);
      setOrb("error", "Error");
    }
  } finally {
    setBusy(false);
    controller = null;
  }
}

composer.addEventListener("submit", (e) => {
  e.preventDefault();
  if (busy) {
    if (controller) controller.abort();
    return;
  }
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  autosize();
  clearNotice();
  handleSend(text);
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!busy) composer.requestSubmit();
  }
});

function autosize() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
}
input.addEventListener("input", autosize);

$("newChatBtn").addEventListener("click", () => {
  startNewChat();
  closeDrawer();
});

// ---- Mobile drawer ----
function openDrawer() {
  sidebar.classList.add("open");
  scrim.hidden = false;
  menuBtn.setAttribute("aria-expanded", "true");
}
function closeDrawer() {
  sidebar.classList.remove("open");
  scrim.hidden = true;
  menuBtn.setAttribute("aria-expanded", "false");
}
menuBtn.addEventListener("click", openDrawer);
scrim.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeDrawer();
    if (!accountOverlay.hidden) closeAccount();
  }
});

// ---- Login / sign-up / reset UI ----
const MODES = {
  login: { title: "Log in to LUXION", submit: "Log in", name: false, email: true, pass: true },
  signup: { title: "Create your account", submit: "Sign up", name: true, email: true, pass: true },
  reset: { title: "Reset password", submit: "Send reset email", name: false, email: true, pass: false },
  recovery: { title: "Set a new password", submit: "Update password", name: false, email: false, pass: true }
};

function setAuthMode(mode) {
  authMode = mode;
  const m = MODES[mode];
  authTitle.textContent = m.title;
  authSubmit.textContent = m.submit;
  nameRow.hidden = !m.name;
  emailRow.hidden = !m.email;
  passRow.hidden = !m.pass;
  authTabs.hidden = mode === "reset" || mode === "recovery";
  forgotBtn.hidden = mode !== "login";
  backBtn.hidden = mode !== "reset";
  tabLogin.setAttribute("aria-selected", String(mode === "login"));
  tabSignup.setAttribute("aria-selected", String(mode === "signup"));
  authPass.autocomplete = mode === "login" ? "current-password" : "new-password";
  setMsg(authMsg, "");
}

function showAuth(mode) {
  setAuthMode(mode);
  authOverlay.hidden = false;
  (mode === "recovery" ? authPass : authEmail).focus();
}
function hideAuth() {
  authOverlay.hidden = true;
  authPass.value = "";
}

tabLogin.addEventListener("click", () => setAuthMode("login"));
tabSignup.addEventListener("click", () => setAuthMode("signup"));
forgotBtn.addEventListener("click", () => setAuthMode("reset"));
backBtn.addEventListener("click", () => setAuthMode("login"));

function friendlyAuthError(err) {
  const m = (err && err.message) || "Something went wrong.";
  if (/invalid login credentials/i.test(m)) return "Wrong email or password. If you just signed up, confirm your email first.";
  if (/email not confirmed/i.test(m)) return "Please confirm your email first (check your inbox and spam).";
  if (/rate limit/i.test(m)) return "Too many emails sent. Please wait a while and try again.";
  if (/network|fetch/i.test(m)) return "Network error. Check your connection.";
  return m;
}

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = authEmail.value.trim();
  const pass = authPass.value;
  const name = authName.value.trim();

  if (MODES[authMode].email && !email) return setMsg(authMsg, "Enter your email.", "err");
  if (MODES[authMode].pass && !pass) return setMsg(authMsg, "Enter your password.", "err");
  if ((authMode === "signup" || authMode === "recovery") && pass.length < 8) {
    return setMsg(authMsg, "Password must be at least 8 characters.", "err");
  }

  authSubmit.disabled = true;
  setMsg(authMsg, "Working...");
  try {
    if (authMode === "login") {
      await auth.signIn(email, pass);
      setMsg(authMsg, "");
    } else if (authMode === "signup") {
      const data = await auth.signUp(email, pass, name);
      if (data.session) setMsg(authMsg, "Account created.", "ok");
      else setMsg(authMsg, "Account created. Check your email (and spam) to confirm it, then log in.", "ok");
    } else if (authMode === "reset") {
      await auth.resetPassword(email);
      setMsg(authMsg, "If that email has an account, a reset link is on its way.", "ok");
    } else if (authMode === "recovery") {
      await auth.updatePassword(pass);
      recovering = false;
      const session = await auth.getSession();
      if (session) await onSignedIn(session, true);
    }
  } catch (err) {
    setMsg(authMsg, friendlyAuthError(err), "err");
  } finally {
    authSubmit.disabled = false;
  }
});

// ---- Account / settings ----
function openAccount() {
  if (!user) return showAuth("login");
  accEmail.value = user.email || "";
  accName.value = displayName;
  setMsg(accMsg, "");
  accountOverlay.hidden = false;
  closeDrawer();
  accName.focus();
}
function closeAccount() {
  accountOverlay.hidden = true;
}
$("settingsBtn").addEventListener("click", openAccount);
$("profileBtn").addEventListener("click", openAccount);
$("accCloseBtn").addEventListener("click", closeAccount);

$("accForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = accName.value.trim().slice(0, 60);
  setMsg(accMsg, "Saving...");
  try {
    await db.saveDisplayName(user.id, name);
    displayName = name;
    setMsg(accMsg, "Saved.", "ok");
  } catch (err) {
    setMsg(accMsg, "Could not save: " + err.message, "err");
  }
});

$("deleteAllBtn").addEventListener("click", async () => {
  if (busy) return setMsg(accMsg, "Wait for the current reply to finish.", "err");
  if (!window.confirm("Delete ALL your saved chats? This cannot be undone.")) return;
  try {
    await db.deleteAllConversations(user.id);
    conversations = [];
    startNewChat();
    setMsg(accMsg, "All chats deleted.", "ok");
  } catch (err) {
    setMsg(accMsg, "Could not delete: " + err.message, "err");
  }
});

$("signOutBtn").addEventListener("click", async () => {
  try {
    await auth.signOut();
    closeAccount();
  } catch (err) {
    setMsg(accMsg, "Could not sign out: " + err.message, "err");
  }
});

// ---- Auth state ----
async function onSignedIn(session, force) {
  if (recovering) return; // finish setting the new password first
  if (!force && user && user.id === session.user.id) {
    user = session.user; // token refresh etc.
    return;
  }
  user = session.user;
  hideAuth();
  try {
    const p = await db.getProfile(user.id);
    displayName = (p && p.display_name) || "";
  } catch {
    displayName = "";
  }
  await loadConversations();
  startNewChat();
}

function onSignedOut() {
  if (busy && controller) controller.abort();
  user = null;
  displayName = "";
  conversations = [];
  current = null;
  chat.textContent = "";
  chatTitle.textContent = "New conversation";
  clearNotice();
  setOrb("idle", "Idle");
  renderHistory();
  closeAccount();
  if (!recovering) showAuth("login");
}

auth.onAuthChange((event, session) => {
  // Do not call Supabase inside this callback directly; defer to avoid deadlocks.
  setTimeout(() => {
    if (event === "PASSWORD_RECOVERY") {
      recovering = true;
      showAuth("recovery");
    } else if (session) {
      onSignedIn(session);
    } else {
      onSignedOut();
    }
  }, 0);
});

// ---- Light particle background (skipped if reduced motion) ----
function startParticles() {
  const canvas = $("particles");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = canvas.getContext("2d");
  const COUNT = window.innerWidth < 800 ? 28 : 55;
  let w, h, pts;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    pts = Array.from({ length: COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.6 + 0.4,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      c: Math.random() > 0.5 ? "168,85,247" : "0,229,255"
    }));
  }
  resize();
  window.addEventListener("resize", resize);

  function frame() {
    if (!document.hidden) {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + p.c + ",0.7)";
        ctx.fill();
      }
    }
    requestAnimationFrame(frame);
  }
  frame();
}

// ---- Init ----
renderHistory();
setOrb("idle", "Idle");
checkBackend();
startParticles();
// Until Supabase reports the session, show the login screen (hidden automatically if already logged in).
showAuth("login");
