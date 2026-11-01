-- 運営からのサイトのお知らせ(2026/10/20)。総合の「お知らせ(メール・LINE・サイト)」から書き、
-- 公開サイトの /news に都道府県に関係なく全員へ出す。
create table if not exists public.site_notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_notices enable row level security;

create policy "public can view published site notices" on public.site_notices
  for select using (published);

create policy "admin can manage site notices" on public.site_notices
  for all using (public.is_admin()) with check (public.is_admin());

create index if not exists site_notices_published_created_idx on public.site_notices (published, created_at desc);
