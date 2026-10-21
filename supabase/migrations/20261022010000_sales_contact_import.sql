-- 営業メール用の店舗連絡先(運営が集めた公開アドレス)と配信停止フラグ(2026/10/22)
create table if not exists public.sales_contact_import (
  id bigint generated always as identity primary key,
  sheet text, name text, pref text, category text, email text, note text,
  matched_store_id uuid, created_at timestamptz default now()
);
alter table public.sales_contact_import enable row level security;
revoke all on public.sales_contact_import from anon, authenticated;
alter table public.stores add column if not exists sales_email_opt_out boolean not null default false;
alter table public.sales_contact_import add column if not exists excluded boolean not null default false;
alter table public.sales_contact_import add column if not exists excluded_reason text;
alter table public.sales_contact_import add column if not exists sent_at timestamptz;
