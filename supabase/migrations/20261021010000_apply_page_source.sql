-- 掲載申し込みページの閲覧と、どこから来たか(広告の目印)を記録する(2026/10/21)
alter table public.page_views add column if not exists source text;
alter table public.listing_applications add column if not exists source text;
