// LUXION AI - Phase 1
// UI only: no AI backend yet. Messages are kept in memory for this page session.
// The AI backend (Cloudflare Worker) is added in Phase 2.

const GREETING = "LUXION online. How can I assist you today?";

// ---- Config (Phase 2 will put your Worker URL here) ----
const CONFIG = {
  WORKER_URL: "" // empty = backend not connected yet
};

// ---- Elements ----
const $ = (id) => document.getElementById(id);
const sidebar = $("sidebar");
const scrim = $("scrim");
const menuBtn = $("menuBtn");
const chat = $("chat");
const input = $("input");
const composer = $("composer");
const orb = $("orb");
const orbLabel = $("orbLabel");
const notice = $("notice");
const historyList = $("historyList");
const chatTitle = $("chatTitle");
const statusDot = $("statusDot");
const statusText = $("statusText");

// ---- State ----
let conversations = []; // { id, title, messages: [{role, content}] }
let current = null;

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
  body.textContent = text; // textContent keeps user text safe (no HTML injection)
  div.appendChild(body);
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
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
  for (const m of current.messages) addBubble(m.role, m.content);
  renderHistory();
}

function startNewChat() {
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
function updateStatus() {
  if (CONFIG.WORKER_URL) {
    statusDot.className = "dot dot-on";
    statusText.textContent = "Backend: configured (untested)";
  } else {
    statusDot.className = "dot dot-off";
    statusText.textContent = "Backend: not connected";
  }
}

// ---- Sending ----
function handleSend(text) {
  if (!current) {
    current = { id: newId(), title: text.slice(0, 40), messages: [] };
    conversations.unshift(current);
    chatTitle.textContent = current.title;
  }
  current.messages.push({ role: "user", content: text });
  addBubble("user", text);
  renderHistory();

  if (!CONFIG.WORKER_URL) {
    // Honest state: there is no AI yet, so we do NOT fake a reply.
    setOrb("error", "Offline");
    const msg = "AI backend is not connected yet. Phase 2 adds the Cloudflare Worker that talks to a real AI model.";
    showNotice(msg);
    addBubble("system", msg);
    return;
  }

  // Phase 2 will implement the real request here.
  setOrb("error", "Offline");
  showNotice("Backend URL is set but chat is not implemented until Phase 2.");
}

composer.addEventListener("submit", (e) => {
  e.preventDefault();
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
    composer.requestSubmit();
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
  const COUNT = window.innerWidth < 800 ? 28 : 55; // fewer on phones for speed
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
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
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
updateStatus();
startParticles();
startNewChat();
