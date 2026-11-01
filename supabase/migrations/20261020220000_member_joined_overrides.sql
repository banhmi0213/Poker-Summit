-- マイページに出す「登録日」を、本当の登録日時とは別に指定する(2026/10/20 オーナー指示)。
-- 表示だけを変える。auth.users の登録日時(ログイン・集計の元)は変えない。運営がSQLで入れる。
create table if not exists public.member_joined_overrides (
  user_id uuid primary key references auth.users(id) on delete cascade,
  joined_on date not null,
  created_at timestamptz not null default now()
);
alter table public.member_joined_overrides enable row level security;
create policy "member reads own joined override" on public.member_joined_overrides
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
revoke all on public.member_joined_overrides from anon;
grant select on public.member_joined_overrides to authenticated;
insert into public.member_joined_overrides (user_id, joined_on)
values ('7ce8b609-7d5e-41b2-97cc-9a9a7233c524', '2026-10-23')
on conflict (user_id) do update set joined_on = excluded.joined_on;
