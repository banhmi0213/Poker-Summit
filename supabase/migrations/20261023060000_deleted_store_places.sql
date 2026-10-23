-- 閉店・営業していない店舗を削除したときの記録(2026/10/23 オーナー指示「閉店とかなってる店舗は削除」)。
-- 店舗を消すと、Googleからの新店さがし・取り込みが同じ店をもう一度「新しい店」として拾ってしまうため、
-- 消した店のGoogleの場所ID(google_place_id)をここに残し、取り込みのときに除外する。
-- 店舗の行を消すと自動でここに入る(トリガー)。間違って消した店は、この表から行を消せば再び取り込める。
create table if not exists public.deleted_store_places (
  google_place_id text primary key,
  name text,
  pref text,
  status text,
  google_business_status text,
  note text,
  deleted_at timestamptz not null default now()
);

alter table public.deleted_store_places enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'deleted_store_places' and policyname = 'deleted_store_places_admin_all') then
    create policy deleted_store_places_admin_all on public.deleted_store_places for all using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

create or replace function public.record_deleted_store_place() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.google_place_id is not null then
    insert into public.deleted_store_places (google_place_id, name, pref, status, google_business_status, note)
    values (old.google_place_id, old.name, old.pref, old.status, old.google_business_status, old.google_match_note)
    on conflict (google_place_id) do update set name = excluded.name, pref = excluded.pref, status = excluded.status,
      google_business_status = excluded.google_business_status, note = excluded.note, deleted_at = now();
  end if;
  return old;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'stores_record_deleted_place' and tgrelid = 'public.stores'::regclass) then
    create trigger stores_record_deleted_place before delete on public.stores
      for each row execute function public.record_deleted_store_place();
  end if;
end $$;
