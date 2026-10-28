-- LUXION AI - Phase 3 database schema (Supabase / PostgreSQL)
-- Run this once: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.

-- ============ TABLES ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 60),
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'New conversation' check (char_length(title) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'ai')),
  content text not null check (char_length(content) between 1 and 20000),
  created_at timestamptz not null default now()
);

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

-- ============ ROW LEVEL SECURITY ============
alter table public.profiles      enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

-- Re-runnable: drop old policies first
drop policy if exists "profiles_select_own"      on public.profiles;
drop policy if exists "profiles_insert_own"      on public.profiles;
drop policy if exists "profiles_update_own"      on public.profiles;
drop policy if exists "conversations_select_own" on public.conversations;
drop policy if exists "conversations_insert_own" on public.conversations;
drop policy if exists "conversations_update_own" on public.conversations;
drop policy if exists "conversations_delete_own" on public.conversations;
drop policy if exists "messages_select_own"      on public.messages;
drop policy if exists "messages_insert_own"      on public.messages;
drop policy if exists "messages_delete_own"      on public.messages;

-- profiles: a user can only see and change their own row
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- conversations: own rows only
create policy "conversations_select_own" on public.conversations
  for select to authenticated using (user_id = (select auth.uid()));
create policy "conversations_insert_own" on public.conversations
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "conversations_update_own" on public.conversations
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "conversations_delete_own" on public.conversations
  for delete to authenticated using (user_id = (select auth.uid()));

-- messages: own rows only, and only inside a conversation the user owns
create policy "messages_select_own" on public.messages
  for select to authenticated using (user_id = (select auth.uid()));
create policy "messages_insert_own" on public.messages
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );
create policy "messages_delete_own" on public.messages
  for delete to authenticated using (user_id = (select auth.uid()));
-- (No update policy on messages: saved messages cannot be edited.)

-- ============ AUTO-CREATE PROFILE ON SIGN-UP ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(new.raw_user_meta_data ->> 'display_name', 60))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Block anonymous (not logged in) access entirely
revoke all on public.profiles, public.conversations, public.messages from anon;
grant select, insert, update, delete on public.profiles, public.conversations, public.messages to authenticated;
