-- 会員登録時のIPアドレスの記録(2026/10)。重複登録の見回り用(自動では弾かない)。
-- 総合管理「会員管理」で、同じIPから短期間に複数登録された会員を目立たせる。
-- プライバシーポリシー「アクセス時にはIPアドレス…のログが取得される場合があります」の範囲。
create table if not exists public.member_signup_logs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists member_signup_logs_ip_idx on public.member_signup_logs (ip, created_at desc);

alter table public.member_signup_logs enable row level security;
drop policy if exists "admin can view signup logs" on public.member_signup_logs;
create policy "admin can view signup logs" on public.member_signup_logs
  for select using (public.is_admin());
revoke all on public.member_signup_logs from anon, authenticated;
grant select on public.member_signup_logs to authenticated;
grant all on public.member_signup_logs to service_role;
