// LUXION AI - voice helpers (browser speech recognition + browser text-to-speech).
// Uses only what the browser provides. There is no wake word: the mic starts only when you tap it.
// Voice preferences are saved on THIS DEVICE only (localStorage), not in the cloud.

const KEY = "luxion.voice.v1";
const DEFAULTS = { speakReplies: false, voiceURI: "", rate: 1, volume: 1, recLang: "en-IN" };

const synth = window.speechSynthesis || null;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;

export const canSpeak = Boolean(synth && window.SpeechSynthesisUtterance);
export const canListen = Boolean(SR);

// ---- Settings (local to this device) ----
export function loadSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    /* storage blocked or corrupt: use defaults */
  }
  const s = { ...DEFAULTS, ...saved };
  s.speakReplies = Boolean(s.speakReplies);
  s.rate = Math.min(2, Math.max(0.5, Number(s.rate) || 1));
  s.volume = Math.min(1, Math.max(0, Number.isFinite(Number(s.volume)) ? Number(s.volume) : 1));
  s.voiceURI = typeof s.voiceURI === "string" ? s.voiceURI : "";
  s.recLang = typeof s.recLang === "string" ? s.recLang : "";
  return s;
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage blocked: settings last for this visit only */
  }
}

// ---- Voices ----
export function getVoices() {
  return synth ? synth.getVoices() : [];
}

export function onVoicesChanged(cb) {
  if (synth) synth.addEventListener("voiceschanged", cb);
}

// ---- Speaking ----
let session = 0; // bumps on every stop/new speech so stale callbacks are ignored
let active = null; // { onEnd } of the speech currently playing

// Remove things that sound bad when read aloud
function cleanForSpeech(text) {
  return text
    .replace(/```[\s\S]*?```/g, " (code block omitted) ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/https?:\/\/\S+/g, " link ")
    .replace(/[*_#>~|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Some mobile browsers cut off long utterances, so speak in short pieces
function chunk(text) {
  const sentences = text.split(/(?<=[.!?।\n])\s+/);
  const out = [];
  let buf = "";
  for (const s of sentences) {
    if (buf && (buf + " " + s).length > 180) {
      out.push(buf);
      buf = s;
    } else {
      buf = buf ? buf + " " + s : s;
    }
    while (buf.length > 220) {
      const cut = buf.lastIndexOf(" ", 200);
      const at = cut > 50 ? cut : 200;
      out.push(buf.slice(0, at));
      buf = buf.slice(at).trim();
    }
  }
  if (buf) out.push(buf);
  return out;
}

function finish(mine) {
  if (mine !== session || !active) return;
  const a = active;
  active = null;
  session++;
  if (a.onEnd) a.onEnd();
}

export function stopSpeaking() {
  if (!synth) return;
  const a = active;
  active = null;
  session++;
  synth.cancel();
  if (a && a.onEnd) a.onEnd();
}

// callbacks: { onStart(), onEnd() }  - onEnd also runs when speech is stopped or fails
export function speak(text, settings, callbacks = {}) {
  if (!canSpeak) return false;
  const clean = cleanForSpeech(text);
  if (!clean) return false;
  stopSpeaking();
  const mine = session;
  active = { onEnd: callbacks.onEnd };
  const parts = chunk(clean);
  const voice = getVoices().find((v) => v.voiceURI === settings.voiceURI) || null;

  parts.forEach((part, i) => {
    const u = new SpeechSynthesisUtterance(part);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    }
    u.rate = settings.rate;
    u.volume = settings.volume;
    if (i === 0) {
      u.onstart = () => {
        if (mine === session && callbacks.onStart) callbacks.onStart();
      };
    }
    u.onend = () => {
      if (i === parts.length - 1) finish(mine);
    };
    u.onerror = () => {
      if (mine !== session) return;
      synth.cancel(); // abandon the rest of this reply
      finish(mine);
    };
    synth.speak(u);
  });
  return true;
}

// ---- Listening ----
// Returns { start(), stop() }. callbacks: { onText(fullText), onError(code), onEnd() }
export function createRecognizer(lang, { onText, onError, onEnd }) {
  const rec = new SR();
  if (lang) rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  rec.onresult = (e) => {
    let text = "";
    for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
    onText(text.trim());
  };
  rec.onerror = (e) => onError(e.error || "unknown");
  rec.onend = () => onEnd();
  return {
    start() {
      rec.start();
    },
    stop() {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
  };
}

export function errorMessage(code) {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was blocked. Tap the lock icon in your browser's address bar, allow the microphone for this site, then try again.";
    case "no-speech":
      return "I didn't hear anything. Tap the mic and try again.";
    case "audio-capture":
      return "No microphone was found on this device.";
    case "network":
      return "Voice input needs an internet connection to the browser's speech service.";
    case "language-not-supported":
      return "That voice input language isn't supported. Pick another in Settings.";
    default:
      return "Voice input failed (" + code + ").";
  }
}
