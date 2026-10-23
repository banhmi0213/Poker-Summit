-- 宣伝リンクの目印(utm_source/utm_campaign を「x/asagiri_suimu_pr」の形にしたもの)をページ閲覧に残す(2026/10/23)。
-- インフルエンサー等の宣伝から何人来たかを数えるため。
alter table public.site_page_views add column if not exists source text;
create index if not exists site_page_views_source_idx on public.site_page_views (source) where source is not null;
