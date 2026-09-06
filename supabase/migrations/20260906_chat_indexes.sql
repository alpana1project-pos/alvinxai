-- Chat performance helpers for Alvin.
create index if not exists conversations_user_updated_idx
  on public.conversations(user_id, updated_at desc);

create index if not exists messages_conversation_created_idx
  on public.messages(conversation_id, created_at asc);

create index if not exists messages_user_created_idx
  on public.messages(user_id, created_at desc);
