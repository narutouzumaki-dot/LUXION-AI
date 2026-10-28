// LUXION AI - Study Mode helpers (builds the request; the AI model writes the actual study material).

export const LEVELS = ["beginner", "intermediate", "advanced"];

export const TASKS = {
  explain: { label: "Explain" },
  steps: { label: "Step by step" },
  summary: { label: "Summary" },
  questions: { label: "Practice questions" },
  flashcards: { label: "Flashcards" },
  revise: { label: "Revise" }
};

const ASKS = {
  explain: (s) => "Explain: " + s,
  steps: (s) => "Teach me this step by step: " + s,
  summary: (s) => "Summarize for studying: " + s,
  questions: (s) => "Give me practice questions on: " + s,
  flashcards: (s) => "Make flashcards for: " + s,
  revise: (s) => "Make a quick revision sheet for: " + s
};

// Returns { text, title, task }. Throws if there is nothing to study.
export function buildStudyPrompt(task, topic, hasFile) {
  if (!ASKS[task]) throw new Error("Unknown study action.");
  const t = (topic || "").trim();
  if (!t && !hasFile) throw new Error("Type a topic first (or attach a file to study).");
  const subject = t || "the attached file";
  return { text: ASKS[task](subject), title: TASKS[task].label + ": " + subject, task };
}
