// LUXION AI - cloud chat history (Supabase PostgreSQL).
// Every call runs as the logged-in user, so Row Level Security limits it to that user's rows.
import { supabase } from "./auth.js";

function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

export async function getProfile(userId) {
  const data = check(await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle());
  return data;
}

export async function saveDisplayName(userId, name) {
  check(await supabase.from("profiles").upsert({ id: userId, display_name: name || null }));
}

export async function listConversations() {
  return check(
    await supabase
      .from("conversations")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false })
      .limit(100)
  );
}

export async function createConversation(title) {
  return check(await supabase.from("conversations").insert({ title }).select("id,title,updated_at").single());
}

export async function loadMessages(conversationId) {
  return check(
    await supabase
      .from("messages")
      .select("role,content,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(500)
  );
}

// Saves one user message + the AI reply together (one insert = all or nothing),
// then bumps the conversation's updated_at.
export async function saveExchange(conversationId, userText, userAt, aiText, aiAt) {
  check(
    await supabase.from("messages").insert([
      { conversation_id: conversationId, role: "user", content: userText, created_at: userAt },
      { conversation_id: conversationId, role: "ai", content: aiText, created_at: aiAt }
    ])
  );
  check(await supabase.from("conversations").update({ updated_at: aiAt }).eq("id", conversationId));
}

export async function renameConversation(id, title) {
  check(await supabase.from("conversations").update({ title }).eq("id", id));
}

export async function deleteConversation(id) {
  check(await supabase.from("conversations").delete().eq("id", id));
}

export async function deleteAllConversations(userId) {
  check(await supabase.from("conversations").delete().eq("user_id", userId));
}
