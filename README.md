# LUXION AI

*Beyond Intelligence. Beyond Limits.*

A personal AI assistant for phone, tablet and laptop. Black, electric-purple and neon-cyan interface.

```
Browser (GitHub Pages)  ->  Cloudflare Worker  ->  Google Gemini
        |                        |
        +--> Supabase Auth + Postgres (login, cloud chat history)
```

The AI key lives only in the Worker. The website contains only public values.

## Project layout

```
LUXION-AI/
├── index.html            page structure
├── css/style.css         styling and themes
├── js/
│   ├── app.js            main app: chat, modes, login UI, settings
│   ├── config.js         public settings (Supabase URL + publishable key, Worker URL)
│   ├── auth.js           Supabase login / sign-up / reset
│   ├── db.js             cloud chat history
│   ├── voice.js          speech input and spoken replies
│   ├── files.js          file reading (text, CSV, JSON, PDF, images)
│   ├── rich.js           safe message rendering, code blocks, flashcards
│   ├── study.js          Study Mode requests
│   ├── coding.js         Coding Lab requests
│   └── settings.js       theme / motion preferences
├── worker/worker.js      Cloudflare Worker (the secure backend)
├── database/schema.sql   tables + Row Level Security policies
├── README.md  TESTING.md  TROUBLESHOOTING.md  .gitignore
```

## Feature status

"Tested" means checked by automated tests with fake (mock) services in a headless browser, or by running the code directly. "Confirmed on phone" means you tried it on a real device. Anything not in the confirmed column still needs your own check, using `TESTING.md`.

| Feature | Status |
|---|---|
| Futuristic UI, AI Core orb, mobile drawer, themes, reduced motion | Implemented, tested (mock) |
| AI chat via Worker, loading state, stop button, copy | Implemented, **confirmed on phone** |
| Login, sign-up, logout, password reset | Implemented, **confirmed on phone** (login/sign-up); reset email flow needs your check |
| Cloud chat history (create, load, rename, delete, sync) | Implemented, **confirmed on phone** (saving); cross-device sync needs your check |
| Row Level Security | Implemented in `schema.sql`; policies not independently attack-tested |
| Voice input and spoken replies | Implemented, **confirmed on phone** |
| Study Mode (levels, explain, steps, summary, questions, flashcards, revise) | Implemented, tested (mock); real AI output needs your check |
| Coding Lab (explain, debug, error analysis, improve, copy code) | Implemented, tested (mock); real AI output needs your check |
| File analysis: TXT, MD, code, CSV, JSON | Implemented, tested (parsers run on sample data) |
| File analysis: images (AI vision) | Implemented; resize/send tested (mock); **real vision answer needs your check** |
| File analysis: PDF (pdf.js from jsDelivr) | Implemented; **not tested here** (the test environment could not download pdf.js). Check with a real PDF |
| Syntax highlighting | **Not included** (code blocks are monospace with a Copy button) |
| Wake word / always-listening | **Not implemented** (the mic only listens after you tap it) |
| Code execution | **Not implemented, by design** (the AI never runs code) |
| In-app account deletion | **Not implemented** (see the Privacy section) |
| Per-user rate limiting | **Not implemented** (only logged-in users can call the AI) |

## Accounts and settings you must provide

| Where | What | Secret? |
|---|---|---|
| Google AI Studio | Gemini API key | **Secret.** Goes only in Cloudflare (below) |
| Cloudflare Worker | `GEMINI_API_KEY` | **Secret** |
| Cloudflare Worker | `GEMINI_MODEL` (e.g. `gemini-3.1-flash-lite`) | no |
| Cloudflare Worker | `ALLOWED_ORIGIN` = `https://narutouzumaki-dot.github.io` | no |
| `js/config.js` | Supabase URL, **publishable** key, Worker URL | public by design |

**Never put in the website, the repo, or chat:** the Gemini key, a Supabase `secret` / `service_role` key, or your database password. If one leaks, rotate it: create a new key in the provider dashboard and update the Cloudflare secret.

## Setup (one time)

### 1. Supabase (login + database)
1. Create a project at supabase.com.
2. **SQL Editor → New query**, paste all of `database/schema.sql`, tap **Run**.
3. **Authentication → URL Configuration**: Site URL `https://narutouzumaki-dot.github.io/LUXION-AI/`, and add `https://narutouzumaki-dot.github.io/**` to Redirect URLs.
4. **Project Settings → API Keys**: copy the Project URL and the **publishable** key into `js/config.js`.
5. Free-plan note: the built-in email sender allows only a few emails per hour. For heavy use, add your own SMTP provider under Authentication.

### 2. Cloudflare Worker (backend)
1. Create a Worker named `luxion-ai` (Workers & Pages → Create → Worker).
2. **Edit code**, paste all of `worker/worker.js`, **Deploy**.
3. **Settings → Variables and Secrets**: add `GEMINI_API_KEY` (Secret), `GEMINI_MODEL` (Text) and `ALLOWED_ORIGIN` (Text). Deploy again.
4. Open `https://<your-worker>.workers.dev/health`. You should see `"keyConfigured":true,"modelConfigured":true`.
5. Put the Worker URL (no trailing slash) in `js/config.js` as `WORKER_URL`.

### 3. GitHub Pages (website)
1. Repo `LUXION-AI` (public). Add all files with the paths shown in the layout above.
2. **Settings → Pages**: Branch `main`, folder `/ (root)`, Save.
3. Site address: `https://narutouzumaki-dot.github.io/LUXION-AI/`.

Updating later: edit a file on GitHub and commit; the site refreshes in about a minute (hard-reload the page to skip the browser cache). Changes to `worker.js` must also be pasted into Cloudflare and deployed.

## How the features work

- **Chat:** your message goes to the Worker, which checks your login with Supabase and then asks Gemini. Replies are saved to your history.
- **Study Mode:** pick a level and topic, then Explain, Step by step, Summary, Practice questions (answers hidden until you tap Show answers), Flashcards (tap to flip) or Revise. All content comes from the AI. If the AI returns flashcards in a different format, you see its raw reply.
- **Coding Lab:** pick a language, paste code, then Explain, Debug, Analyze error or Improve. Code blocks have a Copy code button. The AI cannot run code and the app never runs it; test suggestions yourself.
- **Files:** tap the paperclip. Supported: `.txt .md .log .csv .json .pdf .png .jpg .webp` and common source-code files. Limits: text 2 MB, CSV/JSON 5 MB, PDF 15 MB (first 60 pages), images 10 MB. Files are read in your browser; the extracted text (max 30,000 characters) or a resized image is sent to Gemini only when you press Send. Files are never executed and are not saved, only a "[File attached: name]" note appears in your history. Remove the file with ✕ before sending to cancel.
- **Voice:** tap the mic, speak, review the text, press Send. "Voice replies" speaks answers aloud; every reply also has a Listen button. Works best in Chrome. In Chrome your audio goes to Google for transcription.
- **Settings (this device only):** voice, theme, reduce animations. **Settings (cloud):** display name, chat history.

## Privacy

- Chats are stored in your Supabase database; Row Level Security limits every row to its owner.
- Messages (and attached file text/images) are processed by Google Gemini to produce replies. On the free Gemini tier Google may use submitted content to improve its products, so do not send confidential material.
- Do not share passwords, API keys or private documents in chat.
- Deleting an account: not available in the app. Ask the project owner to remove the user in Supabase (Authentication → Users). Use Settings → "Delete all my chats" to erase your history.

## Known limits

- Replies arrive all at once (no word-by-word streaming).
- Chat history shows your latest 100 conversations and 500 messages per conversation.
- The Gemini free tier has usage limits; you will see "AI usage limit reached" when exceeded.
- Anyone who can sign up can use your Gemini quota. If you want only yourself, turn off sign-ups in Supabase (Authentication → Sign In / Providers) after creating your account.
