-- 先行登録モードを自動で終える日時(2026/10/20、10/25の正式オープンに合わせて自動でOFFにするため)。
-- この日時を過ぎたら、prelaunch_mode が true のままでも先行登録モードは終わった扱いになる。
alter table public.site_settings add column if not exists prelaunch_ends_at timestamptz;
