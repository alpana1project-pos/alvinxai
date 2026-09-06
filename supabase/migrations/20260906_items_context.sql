-- Alvin context inbox migration.
-- Apply after the existing Alvin schema.

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  item_type text not null default 'inbox'
    check (item_type in ('inbox','note','idea','task','finance','other')),
  status text not null default 'pending'
    check (status in ('pending','processed','archived')),
  source text not null default 'chat',
  ai_confidence numeric(5,4),
  ai_reason text,
  metadata jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists items_user_created_idx
  on public.items(user_id, created_at desc);

create index if not exists items_user_status_idx
  on public.items(user_id, status);

alter table public.items enable row level security;

drop policy if exists "items_select_own" on public.items;
drop policy if exists "items_insert_own" on public.items;
drop policy if exists "items_update_own" on public.items;
drop policy if exists "items_delete_own" on public.items;

create policy "items_select_own" on public.items
  for select to authenticated
  using (user_id = auth.uid());

create policy "items_insert_own" on public.items
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "items_update_own" on public.items
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "items_delete_own" on public.items
  for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.items to authenticated;
