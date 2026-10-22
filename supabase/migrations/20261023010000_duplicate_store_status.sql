-- 同じ店が二重に掲載されている場合の片方(2026/10/23)。status='duplicate' は公開サイトに出ない
-- (公開側は approved/listed、自動チェックは pending/approved だけを見ているため)。消さずに残すので、いつでも戻せる。
alter table public.stores drop constraint if exists stores_status_check;
alter table public.stores add constraint stores_status_check check (status = any (array['pending','approved','rejected','listed','payment_suspended','closed','test','duplicate']));
