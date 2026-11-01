-- 店舗が消えた・公開状態が変わったときの記録(2026/10/22)。
-- 公開中の店が1つ減ったのに、どの店か・誰が消したか分からなかったため。削除は行ごと残す。
create table if not exists public.store_change_log (
  id bigint generated always as identity primary key,
  store_id uuid,
  op text not null,
  old_status text,
  new_status text,
  store_name text,
  old_row jsonb,
  actor uuid,
  db_user text,
  created_at timestamptz not null default now()
);
alter table public.store_change_log enable row level security;
revoke all on public.store_change_log from anon, authenticated;

create or replace function private.log_store_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.store_change_log(store_id, op, old_status, store_name, old_row, actor, db_user)
    values (old.id, 'delete', old.status, old.name, to_jsonb(old), auth.uid(), current_user);
    return old;
  elsif old.status is distinct from new.status then
    insert into public.store_change_log(store_id, op, old_status, new_status, store_name, actor, db_user)
    values (new.id, 'status', old.status, new.status, new.name, auth.uid(), current_user);
  end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'stores_change_log') then
    create trigger stores_change_log after update or delete on public.stores
      for each row execute function private.log_store_change();
  end if;
end $$;
