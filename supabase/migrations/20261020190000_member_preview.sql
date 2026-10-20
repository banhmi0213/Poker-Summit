-- 先行会員へのサイト公開(2026/10/20)。先行登録モード中でも、ONの間はログインした会員(メール確認済み)にサイト全体を見せる。
-- ディーラーマッチング(スポット求人・ディーラー登録・マッチング)は正式オープンまで閉じたまま。
alter table public.site_settings add column if not exists member_preview boolean not null default false;
