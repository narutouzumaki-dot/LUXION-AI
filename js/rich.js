// LUXION AI - safe rendering of messages: code blocks with a Copy button, flashcards, hidden answers.
// Everything is built with textContent / DOM nodes, never innerHTML, so message text can't inject HTML.

async function copyToClipboard(text, btn, label) {
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = "Copied";
  } catch {
    btn.textContent = "Copy failed";
  }
  setTimeout(() => (btn.textContent = label), 1500);
}

function addText(container, chunk) {
  const t = chunk.replace(/^\n+|\n+$/g, "");
  if (!t) return;
  const div = document.createElement("div");
  div.className = "rich-text";
  div.textContent = t;
  container.appendChild(div);
}

function addCode(container, lang, code) {
  const wrap = document.createElement("div");
  wrap.className = "codeblock";
  const head = document.createElement("div");
  head.className = "code-head";
  const label = document.createElement("span");
  label.textContent = lang || "code";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "code-copy";
  btn.textContent = "Copy code";
  btn.addEventListener("click", () => copyToClipboard(code, btn, "Copy code"));
  head.appendChild(label);
  head.appendChild(btn);
  const pre = document.createElement("pre");
  const c = document.createElement("code");
  c.textContent = code;
  pre.appendChild(c);
  wrap.appendChild(head);
  wrap.appendChild(pre);
  container.appendChild(wrap);
}

// Plain text with ``` fenced code blocks
export function renderRich(container, text) {
  container.textContent = "";
  const re = /```([^\n`]*)\n?([\s\S]*?)(?:```|$)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) addText(container, text.slice(last, m.index));
    addCode(container, m[1].trim(), m[2].replace(/\n$/, ""));
    last = re.lastIndex;
    if (m[0] === "") re.lastIndex++;
  }
  if (last < text.length) addText(container, text.slice(last));
}

// ---- Study Mode helpers ----
export function parseFlashcards(text) {
  let s = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (!s.startsWith("[")) return null;
  try {
    const arr = JSON.parse(s);
    if (
      Array.isArray(arr) &&
      arr.length > 0 &&
      arr.length <= 60 &&
      arr.every((c) => c && typeof c.front === "string" && typeof c.back === "string")
    ) {
      return arr.map((c) => ({ front: c.front, back: c.back }));
    }
  } catch {
    /* not flashcard JSON: show the reply as plain text */
  }
  return null;
}

export const ANSWERS_MARKER = "--- ANSWERS ---";

export function splitAnswers(text) {
  const i = text.indexOf(ANSWERS_MARKER);
  if (i < 0) return null;
  const questions = text.slice(0, i).trim();
  const answers = text.slice(i + ANSWERS_MARKER.length).trim();
  if (!questions || !answers) return null;
  return { questions, answers };
}

function renderFlashcards(container, cards) {
  container.textContent = "";
  const note = document.createElement("div");
  note.className = "rich-text fine";
  note.textContent = cards.length + " flashcards. Tap a card to flip it.";
  container.appendChild(note);
  const grid = document.createElement("div");
  grid.className = "flashcards";
  cards.forEach((card, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "flashcard";
    let showBack = false;
    const draw = () => {
      b.textContent = (showBack ? "Answer: " : "Q" + (i + 1) + ": ") + (showBack ? card.back : card.front);
      b.dataset.side = showBack ? "back" : "front";
      b.setAttribute("aria-label", "Flashcard " + (i + 1) + ", showing the " + (showBack ? "answer" : "question") + ". Tap to flip.");
    };
    b.addEventListener("click", () => {
      showBack = !showBack;
      draw();
    });
    draw();
    grid.appendChild(b);
  });
  container.appendChild(grid);
}

// Renders an AI reply: flashcards if the reply is flashcard JSON, hidden answers if present, else rich text
export function renderAi(container, text) {
  const cards = parseFlashcards(text);
  if (cards) return renderFlashcards(container, cards);
  const parts = splitAnswers(text);
  if (parts) {
    container.textContent = "";
    const q = document.createElement("div");
    renderRich(q, parts.questions);
    container.appendChild(q);
    const a = document.createElement("div");
    a.hidden = true;
    renderRich(a, parts.answers);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-btn";
    btn.textContent = "Show answers";
    btn.setAttribute("aria-expanded", "false");
    btn.addEventListener("click", () => {
      a.hidden = !a.hidden;
      btn.textContent = a.hidden ? "Show answers" : "Hide answers";
      btn.setAttribute("aria-expanded", String(!a.hidden));
    });
    container.appendChild(btn);
    container.appendChild(a);
    return;
  }
  renderRich(container, text);
}
