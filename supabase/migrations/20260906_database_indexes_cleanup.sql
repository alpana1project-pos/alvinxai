create index if not exists accounts_user_id_idx on public.accounts(user_id);
create index if not exists transactions_account_id_idx on public.transactions(account_id);
drop index if exists public.messages_conversation_created_idx;
