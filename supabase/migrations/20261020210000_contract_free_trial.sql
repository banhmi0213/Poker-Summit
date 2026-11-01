-- 知り合いの店などを「◯か月無料」で契約する(2026/10/20 オーナー指示)。
-- 無料になるのは月額プランだけ。無料期間の終わりに、続けるかどうかを決める
-- (店舗がカードを登録していれば自動で続く/振込で続けるか終了するかは運営が契約の画面で決める)。
alter table public.store_contracts add column if not exists trial_ends_at timestamptz;
alter table public.store_contracts add column if not exists trial_notice_sent_at timestamptz;
alter table public.store_contracts add column if not exists trial_end_notified_at timestamptz;
