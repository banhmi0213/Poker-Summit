-- UU(何人が見たか)を数えるための閲覧者番号(2026/10/21)。名前などの個人情報ではなく、ブラウザごとのランダムな番号。
alter table public.page_views add column if not exists visitor_id text;
create index if not exists page_views_visitor_idx on public.page_views (created_at, visitor_id);

-- サイト全体の閲覧(TOP・店舗一覧・サミットなど、全部の公開ページ)。運営(サービスロール)だけが読み書きする。
create table if not exists public.site_page_views (
  id bigint generated always as identity primary key,
  path text not null,
  visitor_id text,
  referrer text,
  device text,
  created_at timestamptz not null default now()
);
create index if not exists site_page_views_created_idx on public.site_page_views (created_at);
alter table public.site_page_views enable row level security;
revoke all on public.site_page_views from anon, authenticated;

-- 期間内のPV・UUをまとめて数える(行を全部取らずに済むように)
create or replace function public.admin_site_pv_uu(p_since timestamptz)
returns table (site_pv bigint, site_uu bigint, store_pv bigint, store_uu bigint)
language sql security definer set search_path = public as $$
  select
    (select count(*) from site_page_views where created_at >= p_since),
    (select count(distinct visitor_id) from site_page_views where created_at >= p_since and visitor_id is not null),
    (select count(*) from page_views where created_at >= p_since and store_id is not null),
    (select count(distinct visitor_id) from page_views where created_at >= p_since and store_id is not null and visitor_id is not null);
$$;
revoke all on function public.admin_site_pv_uu(timestamptz) from public, anon, authenticated;
notify pgrst, 'reload schema';
