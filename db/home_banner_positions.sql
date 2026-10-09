-- TOPページの4種類の追加バナー位置を許可する。
-- 既存データは削除・変更しない。
alter table public.banners drop constraint if exists banners_position_check;
alter table public.banners add constraint banners_position_check
  check (position in (
    'top', 'sidebar', 'footer', 'store_list', 'job_list', 'job_detail',
    'home_coupon', 'home_community', 'home_ranking', 'home_jobs'
  ));
