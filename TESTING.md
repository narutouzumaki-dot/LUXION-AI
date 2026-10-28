# LUXION AI testing checklist

Run these on your phone after any update. Reload in a private tab first so nothing is cached.

## 1. Basics
- [ ] Page loads with the black/purple/cyan theme and the orb animates
- [ ] Status pill says **Backend: online**
- [ ] ☰ opens and closes the chat drawer
- [ ] Settings → Theme changes colors; "Reduce animations" stops the orb and particles; both survive a reload

## 2. Account
- [ ] Sign up with a new email (password of 8+ characters); confirmation email arrives (check spam)
- [ ] Log in works; wrong password shows a clear message
- [ ] Forgot password: reset email arrives, the link opens the app on "Set a new password", and the new password works
- [ ] Settings → Save display name; the name appears on your messages after reload
- [ ] Sign out returns to the login screen and clears the chat list

## 3. Chat and history
- [ ] Send a message, get a reply, tap Copy
- [ ] Tap Send during a reply: it shows **Stop** and stopping works
- [ ] The chat appears in the sidebar; reload and it is still there
- [ ] Rename (✎) and delete (🗑) a chat
- [ ] Log in on a second device: the same chats appear
- [ ] With a second test account: you cannot see the first account's chats
- [ ] Turn off Wi-Fi and send: a clear network error appears

## 4. Voice
- [ ] Tap 🎤, allow the microphone, speak: your words appear in the box before sending
- [ ] Deny the microphone permission: a clear message explains how to allow it
- [ ] "Voice replies: on" speaks new replies; **Stop speaking** and turning it off both silence speech
- [ ] Listen button under a reply speaks it
- [ ] Settings → change voice, speed, volume, then Test voice

## 5. Study Mode
- [ ] Study tab, empty topic → asks for a topic
- [ ] Explain, Step by step, Summary at each level (compare Beginner and Advanced answers)
- [ ] Practice questions: answers are hidden until **Show answers**
- [ ] Flashcards: cards appear and flip on tap (if the AI answers in the wrong format you will see raw text; try again)
- [ ] Type a follow-up question in the message box

## 6. Coding Lab
- [ ] Paste code with a deliberate bug → Debug: finds the bug and shows a code block
- [ ] **Copy code** copies the block
- [ ] Analyze error with only an error message pasted
- [ ] The banner says code is not executed; replies never claim the code was run

## 7. Files
- [ ] 📎 a `.txt` file: name and size shown, then Send: the reply uses the content; history shows only "[File attached: …]"
- [ ] A `.csv`: summary line shows rows x columns
- [ ] A valid and an invalid `.json`: invalid one shows an error
- [ ] A real **PDF with text**: progress bar then ready (needs internet). Then a scanned PDF: clear "no selectable text" message
- [ ] A **photo or screenshot with text**: thumbnail shows; ask "Read the text in this image"
- [ ] Unsupported type (`.zip`), an empty file, and a very large file are rejected with clear messages
- [ ] ✕ removes the file before sending

## 8. Security spot checks
- [ ] Open the Worker URL + `/chat` in a browser address bar: you must NOT get an AI reply
- [ ] View page source on the live site: no Gemini key, no `secret`/`service_role` key anywhere
- [ ] Supabase dashboard → Table Editor: `profiles`, `conversations`, `messages` each show **RLS enabled**

Record anything that fails and send it with the exact error text.
