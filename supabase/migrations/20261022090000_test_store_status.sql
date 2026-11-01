-- テスト用の店舗(2026/10/22)。status='test' は公開サイトの一覧・件数・地図・サイトマップ・自動チェックのどれにも出ない
-- (公開側は approved/listed、自動チェックは pending/approved だけを見ているため)。
alter table public.stores drop constraint if exists stores_status_check;
alter table public.stores add constraint stores_status_check check (status = any (array['pending','approved','rejected','listed','payment_suspended','closed','test']));
