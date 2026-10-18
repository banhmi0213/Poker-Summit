-- 決済の二重請求防止と結果不明の管理(2026/10/18)
-- payment_attempts: カード決済1回ごとの台帳。group_key(何の支払いか)ごとに
--   「処理中・結果不明・成功」は同時に1件しか作れない(部分ユニーク索引)。
--   失敗した場合だけ、次の試行(attempt_no+1)を作れる。
create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  attempt_no integer not null default 1,
  idem_key text not null unique,
  purpose text not null,
  status text not null default 'pending' check (status in ('pending','captured','failed','unknown')),
  amount integer not null check (amount > 0),
  customer_id text not null,
  store_contract_id uuid,
  store_contract_addon_id uuid,
  listing_application_id uuid,
  store_id uuid,
  komoju_payment_id text,
  error text,
  context jsonb not null default '{}'::jsonb,
  resolved_by uuid,
  resolved_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_key, attempt_no)
);
create unique index if not exists payment_attempts_one_live_per_group
  on public.payment_attempts (group_key) where status in ('pending','captured','unknown');
create index if not exists payment_attempts_status_idx on public.payment_attempts (status, created_at);
alter table public.payment_attempts enable row level security;
create policy "admins read payment_attempts" on public.payment_attempts for select using (public.is_admin());

-- cron_runs: 毎日の自動処理の結果(運営が総合管理で確認できるように)
create table if not exists public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  failures integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  errors jsonb not null default '[]'::jsonb
);
create index if not exists cron_runs_job_idx on public.cron_runs (job, started_at desc);
alter table public.cron_runs enable row level security;
create policy "admins read cron_runs" on public.cron_runs for select using (public.is_admin());

-- 契約の更新日(毎月この日。月末より大きい日は月末)
alter table public.store_contracts add column if not exists billing_anchor_day integer check (billing_anchor_day between 1 and 31);

-- アドオン単独のカード更新の更新日
alter table public.store_contract_addons add column if not exists billing_anchor_day integer check (billing_anchor_day between 1 and 31);

-- カードのアドオン購入: 同じお申し込み(二重送信)を見分ける
alter table public.addon_orders add column if not exists payment_group_key text;
create index if not exists addon_orders_payment_group_key_idx on public.addon_orders (payment_group_key);

-- 1つの申込みから店舗が2つできないように(入金確認・決済後の処理をやり直しても同じ店舗を使う)
create unique index if not exists stores_source_application_id_unique on public.stores (source_application_id) where source_application_id is not null;

-- 掲載申込みの二重送信: 同じ画面(同じ番号)からの申込みは1件だけ
alter table public.listing_applications add column if not exists request_key text;
create unique index if not exists listing_applications_request_key_key on public.listing_applications (request_key) where request_key is not null;

-- 解約は契約期間の終わり(満期)で終了。終了した店舗は status='closed'(公開・総合管理の店舗一覧から外す。請求・入金の記録は残す)
alter table public.store_contracts add column if not exists cancel_at_period_end boolean not null default false;
alter table public.store_contracts add column if not exists cancel_requested_at timestamptz;
alter table public.stores drop constraint if exists stores_status_check;
alter table public.stores add constraint stores_status_check check (status = any (array['pending','approved','rejected','listed','payment_suspended','closed']));
