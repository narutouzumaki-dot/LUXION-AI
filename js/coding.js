// LUXION AI - Coding Lab helpers.
// The AI reads and suggests code. LUXION never runs your code, and uploaded code files are never executed.

export const LANGUAGES = [
  "JavaScript", "TypeScript", "Python", "Java", "C", "C++", "C#", "Go", "Rust",
  "PHP", "Ruby", "Kotlin", "Swift", "SQL", "HTML/CSS", "Bash", "Other"
];

export const ACTIONS = {
  explain: { label: "Explain", ask: "Explain what this code does, step by step." },
  debug: { label: "Debug", ask: "Find the bugs in this code and show how to fix them." },
  error: { label: "Analyze error", ask: "Explain this error message and how to fix it." },
  improve: { label: "Improve", ask: "Suggest improvements (correctness, readability, performance, safety) and show an improved version." }
};

export const LIMITS = { code: 6000, notes: 2000 };

const TAGS = { "C++": "cpp", "C#": "csharp", "HTML/CSS": "html", Bash: "bash", Other: "" };

// Returns { text, title, task }. Throws a friendly error for missing input.
export function buildCodePrompt({ action, language, code, notes }) {
  const a = ACTIONS[action];
  if (!a) throw new Error("Unknown action.");
  const c = (code || "").trim();
  const n = (notes || "").trim();
  if (action === "error") {
    if (!n && !c) throw new Error("Paste the error message (and your code if you can).");
  } else if (!c) {
    throw new Error("Paste some code first.");
  }
  if (c.length > LIMITS.code) throw new Error("Code is too long (max " + LIMITS.code + " characters).");
  if (n.length > LIMITS.notes) throw new Error("Notes are too long (max " + LIMITS.notes + " characters).");

  const tag = TAGS[language] !== undefined ? TAGS[language] : String(language).toLowerCase();
  let text = a.ask + "\n\nLanguage: " + language;
  if (c) text += "\n\n```" + tag + "\n" + c.replace(/```/g, "` ` `") + "\n```";
  if (n) text += "\n\nError message / notes:\n" + n.replace(/```/g, "` ` `");
  return { text, title: a.label + " " + language + " code", task: action };
}
