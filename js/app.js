// LUXION AI - Phase 2
// Chat now talks to a real AI through your Cloudflare Worker.
// History is still kept only in this browser tab (cloud history comes in Phase 3).

const GREETING = "LUXION online. How can I assist you today?";

// ---- Config ----
// After you create your Worker, paste its URL below (no trailing slash).
// Example: "https://luxion-worker.yourname.workers.dev"
const CONFIG = {
  WORKER_URL: "https://luxion-worker.yourname.workers.dev",
  MAX_CONTEXT_MESSAGES: 20
};

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

// ---- State ----
let conversations = []; // { id, title, messages: [{role: "user"|"ai", content}] }
let current = null;
let busy = false;
let controller = null;

// ---- Helpers ----
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

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
    meta.textContent = role === "user" ? "You" : "LUXION";
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

function renderHistory() {
  historyList.textContent = "";
  if (conversations.length === 0) {
    const p = document.createElement("li");
    p.className = "history-empty";
    p.textContent = "No conversations yet.";
    historyList.appendChild(p);
    return;
  }
  for (const c of conversations) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = c.title;
    if (current && c.id === current.id) b.setAttribute("aria-current", "true");
    b.addEventListener("click", () => {
      if (busy) return;
      openConversation(c.id);
      closeDrawer();
    });
    li.appendChild(b);
    historyList.appendChild(li);
  }
}

function openConversation(id) {
  current = conversations.find((c) => c.id === id) || null;
  chat.textContent = "";
  clearNotice();
  if (!current) return;
  chatTitle.textContent = current.title;
  setOrb("idle", "Idle");
  for (const m of current.messages) addBubble(m.role, m.content);
  renderHistory();
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
  if (!CONFIG.WORKER_URL) {
    statusDot.className = "dot dot-off";
    statusText.textContent = "Backend: not connected";
    return;
  }
  statusDot.className = "dot dot-off";
  statusText.textContent = "Backend: checking...";
  try {
    const res = await fetch(CONFIG.WORKER_URL + "/health");
    const data = await res.json();
    if (data.ok && data.keyConfigured && data.modelConfigured) {
      statusDot.className = "dot dot-on";
      statusText.textContent = "Backend: online";
    } else {
      statusDot.className = "dot dot-off";
      statusText.textContent = "Backend: setup incomplete";
    }
  } catch {
    statusDot.className = "dot dot-off";
    statusText.textContent = "Backend: unreachable";
  }
}

// ---- Sending ----
async function handleSend(text) {
  if (!current) {
    current = { id: newId(), title: text.slice(0, 40), messages: [] };
    conversations.unshift(current);
    chatTitle.textContent = current.title;
  }
  current.messages.push({ role: "user", content: text });
  addBubble("user", text);
  renderHistory();

  if (!CONFIG.WORKER_URL) {
    setOrb("error", "Offline");
    const msg = "AI backend is not connected. Set WORKER_URL in js/app.js.";
    showNotice(msg);
    addBubble("system", msg);
    current.messages.pop(); // do not keep an unanswered message in context
    return;
  }

  setBusy(true);
  setOrb("thinking", "Thinking");
  const loading = addBubble("system", "LUXION is thinking...");
  controller = new AbortController();

  const payload = current.messages
    .slice(-CONFIG.MAX_CONTEXT_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content }));

  try {
    const res = await fetch(CONFIG.WORKER_URL + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      const reason = (data && data.error) || "Request failed (" + res.status + ").";
      throw new Error(reason);
    }

    loading.remove();
    current.messages.push({ role: "ai", content: data.reply });
    addBubble("ai", data.reply);
    setOrb("idle", "Idle");
  } catch (err) {
    loading.remove();
    if (err.name === "AbortError") {
      current.messages.pop(); // drop the unanswered user message from context
      addBubble("system", "Generation stopped.");
      setOrb("idle", "Idle");
    } else {
      current.messages.pop();
      const msg = err instanceof TypeError
        ? "Network error: could not reach the backend."
        : err.message;
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

// Enter sends, Shift+Enter makes a new line
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
  if (e.key === "Escape") closeDrawer();
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
        p.x += p.vx; p.y += p.vy;
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
checkBackend();
startParticles();
startNewChat();
