-- 会員登録で止まった理由の記録(2026/10/20。「送信したのに会員ができていない」人の原因を見えるようにする)。
-- メールアドレス・パスワードは残さない(メールはドメインだけ)。運営だけが読める。
create table if not exists public.signup_errors (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  reason text not null,
  message text,
  detail text,
  email_domain text,
  device text,
  in_app text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists signup_errors_created_idx on public.signup_errors (created_at desc);
alter table public.signup_errors enable row level security;
create policy "admin reads signup errors" on public.signup_errors for select to authenticated using (public.is_admin());
revoke all on public.signup_errors from anon, authenticated;
grant select on public.signup_errors to authenticated;
grant all on public.signup_errors to service_role;
