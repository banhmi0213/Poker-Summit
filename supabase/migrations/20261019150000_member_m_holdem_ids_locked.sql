-- m HOLD'EM ID は一度登録したら本人は変更できない(2026/10/19、ユーザー指示「複垢があるから変更できないように」)。
-- これまでは auth.users.raw_user_meta_data(本人がいつでも書き換えられる)に入れていたため、
-- 本人が書き換えられない専用テーブルに保存する。変更は運営(総合管理)のみ。
create table if not exists public.member_m_holdem_ids (
  user_id uuid primary key references auth.users(id) on delete cascade,
  m_holdem_id text not null check (char_length(m_holdem_id) between 1 and 64 and m_holdem_id !~ '\s'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.member_m_holdem_ids enable row level security;
-- 本人は見るだけ(書き込みは下の関数経由のみ)
create policy "own m holdem id readable" on public.member_m_holdem_ids for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.member_m_holdem_ids from anon, authenticated;

-- 既存の登録分を移す
insert into public.member_m_holdem_ids (user_id, m_holdem_id, created_at)
select u.id, btrim(u.raw_user_meta_data->>'m_holdem_id'), u.created_at
from auth.users u
where nullif(btrim(u.raw_user_meta_data->>'m_holdem_id'), '') is not null
  and btrim(u.raw_user_meta_data->>'m_holdem_id') !~ '\s'
  and char_length(btrim(u.raw_user_meta_data->>'m_holdem_id')) <= 64
on conflict (user_id) do nothing;

-- 会員登録時に入力されたIDを保存する(登録フォームの値は raw_user_meta_data に入って届く)
create or replace function private.capture_m_holdem_id_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v text := nullif(btrim(new.raw_user_meta_data->>'m_holdem_id'), '');
begin
  if v is not null and v !~ '\s' and char_length(v) <= 64 then
    insert into public.member_m_holdem_ids (user_id, m_holdem_id) values (new.id, v) on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;
create or replace trigger capture_m_holdem_id_on_signup
  after insert on auth.users
  for each row execute function private.capture_m_holdem_id_on_signup();

-- 本人: まだ登録していない場合だけ1回登録できる
create or replace function public.set_my_m_holdem_id(p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v text := btrim(coalesce(p_id, ''));
begin
  if auth.uid() is null then raise exception 'ログインしてください。'; end if;
  if v = '' then return; end if;
  if v ~ '\s' or char_length(v) > 64 then raise exception 'm HOLD''EM IDは空白を含めず、64文字以内で入力してください。'; end if;
  if exists (select 1 from public.member_m_holdem_ids where user_id = auth.uid()) then
    raise exception 'm HOLD''EM IDは登録後に変更できません。変更が必要な場合はお問い合わせください。';
  end if;
  insert into public.member_m_holdem_ids (user_id, m_holdem_id) values (auth.uid(), v);
end;
$$;
revoke all on function public.set_my_m_holdem_id(text) from public, anon;
grant execute on function public.set_my_m_holdem_id(text) to authenticated;

-- 運営: 変更・削除(入力間違いの訂正など)。空にすると削除
create or replace function public.admin_set_member_m_holdem_id(p_user_id uuid, p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v text := btrim(coalesce(p_id, ''));
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if v = '' then
    delete from public.member_m_holdem_ids where user_id = p_user_id;
    return;
  end if;
  if v ~ '\s' or char_length(v) > 64 then raise exception 'm HOLD''EM IDは空白を含めず、64文字以内で入力してください。'; end if;
  insert into public.member_m_holdem_ids (user_id, m_holdem_id, updated_by) values (p_user_id, v, auth.uid())
  on conflict (user_id) do update set m_holdem_id = excluded.m_holdem_id, updated_at = now(), updated_by = auth.uid();
end;
$$;
revoke all on function public.admin_set_member_m_holdem_id(uuid, text) from public, anon;
grant execute on function public.admin_set_member_m_holdem_id(uuid, text) to authenticated;

-- 総合管理・まとめメールは専用テーブルから読む
create or replace function public.admin_member_m_holdem_ids()
returns table(user_id uuid, m_holdem_id text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query select m.user_id, m.m_holdem_id from public.member_m_holdem_ids m;
end;
$$;

create or replace function public.member_m_holdem_ids_between(p_since timestamptz, p_until timestamptz)
returns table(email text, m_holdem_id text)
language sql
stable
security definer
set search_path = public
as $$
  select u.email::text, m.m_holdem_id
  from auth.users u
  join public.member_m_holdem_ids m on m.user_id = u.id
  where u.created_at >= p_since and u.created_at < p_until;
$$;
