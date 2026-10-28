# LUXION AI troubleshooting

## The page looks unstyled or does nothing
- File paths must match exactly: `css/style.css`, `js/app.js`, `js/config.js`, `js/auth.js`, `js/db.js`, `js/voice.js`, `js/files.js`, `js/rich.js`, `js/study.js`, `js/coding.js`, `js/settings.js`. One missing file stops the whole app.
- Hard-reload or use a private tab (the browser may be showing old files). GitHub Pages can take 1-2 minutes after a commit.
- Phone tip: Chrome menu → turn on **Desktop site** when editing on github.com.

## Status pill says "Backend: unreachable" or "setup incomplete"
- Open `<worker-url>/health`.
  - Page not found / error: the `WORKER_URL` in `js/config.js` is wrong (no trailing slash, https).
  - `keyConfigured:false`: add the `GEMINI_API_KEY` secret in Cloudflare and Deploy.
  - `modelConfigured:false`: add `GEMINI_MODEL` and Deploy.
  - "Hello World": the Worker still has the default code; paste `worker/worker.js` and Deploy.

## Chat shows an error
| Message | Fix |
|---|---|
| Origin not allowed | `ALLOWED_ORIGIN` must be exactly `https://narutouzumaki-dot.github.io` (no slash, no `/LUXION-AI`) |
| Please log in to use LUXION | Log out and in again; check `SUPABASE_URL`/key in `js/config.js` |
| Model not found | `GEMINI_MODEL` is wrong; use an exact model ID from Google AI Studio |
| AI service rejected the request | Gemini key invalid or model not allowed for your key/plan |
| AI usage limit reached | Free-tier quota used; wait or use another model/key |
| The AI returned no text | The reply was blocked or empty; rephrase and retry |
| Network error | Check internet; check the Worker is deployed |
| The conversation is too long | Start a New Chat |

## Login problems
- Confirmation email not arriving: check spam; the free built-in sender allows only a few emails per hour. Wait, or temporarily disable "Confirm email" in Supabase → Authentication → Sign In / Providers → Email (re-enable for real use).
- Email links open the wrong page: fix **Site URL** and **Redirect URLs** in Supabase → Authentication → URL Configuration.
- "Invalid login credentials": wrong password, or the email is not confirmed yet.

## Chats are not saved ("could not be saved to the cloud")
- `database/schema.sql` was not run, or failed partway. Run it again (it is safe to re-run).
- Supabase project paused (free projects pause after inactivity): open the dashboard and restore it.

## Voice
- Mic button does nothing: browser lacks speech recognition (use Chrome). Settings shows a note.
- "Microphone access was blocked": tap the lock icon in the address bar → allow microphone → reload.
- No sound for replies: raise volume, check phone is not on silent, try another voice in Settings, tap Listen on a reply.
- Voice input needs internet (Chrome uses Google's speech service).

## Files
- "Could not load the PDF reader": needs internet to fetch pdf.js from cdn.jsdelivr.net; check connection or content blockers.
- "No selectable text found": the PDF is a scan; attach a photo/screenshot instead.
- "Unsupported file type": see the supported list in README. `.docx`, `.xlsx`, `.zip` are not supported.
- Image answers are wrong or empty: the model set in `GEMINI_MODEL` may not support images. Try another Gemini model.

## Study / Coding
- Flashcards show as plain text: the AI did not follow the JSON format; press Flashcards again.
- Code answers look cut off: very long replies are saved shortened; ask for the rest in a follow-up.

## Updating the Worker
Changes to `worker/worker.js` on GitHub do nothing by themselves. Paste the new code into Cloudflare (Worker → Edit code) and Deploy.
