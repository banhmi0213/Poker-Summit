-- Add a dedicated wide banner slot immediately below PICK UP stores and above TOP ads.
-- Keep all existing banner records and supported positions intact.
ALTER TABLE public.banners DROP CONSTRAINT IF EXISTS banners_position_check;
ALTER TABLE public.banners ADD CONSTRAINT banners_position_check
  CHECK (position IN (
    'top', 'sidebar', 'footer', 'store_list', 'job_list', 'job_detail',
    'home_coupon', 'home_community', 'home_ranking', 'home_jobs',
    'home_footer_three', 'home_pickup'
  ));
