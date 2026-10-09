-- 銀行振込による支払い(2026/10)
-- - 申込み時に「カード」か「銀行振込」を選ぶ。振込は 毎月 / 6か月 / 12か月 まとめ払い
--   (まとめ払いは 6か月で10%OFF・12か月で2か月分無料。管理画面から変更可)
-- - 振込の請求は invoices に1件ずつ記録し、インボイス対応の請求書PDFをメールで送る
-- - 入金確認は運営が総合管理の「入金管理」で行う(確認すると店舗発行・契約更新)
-- - 支払期限は請求から7日。期限の前日にリマインド、期限の翌日に店舗ページを非公開。
--   入金確認で元の公開状態に戻す。

-- 1) 振込の設定 ----------------------------------------------------------------
alter table public.site_settings
  add column if not exists bank_transfer_info jsonb,
  add column if not exists invoice_registration_number text,
  add column if not exists transfer_due_days integer not null default 7,
  add column if not exists prepay_discounts jsonb not null
    default '{"6": {"type": "percent", "value": 10}, "12": {"type": "free_months", "value": 2}}'::jsonb,
  add column if not exists card_payment_enabled boolean not null default true;

comment on column public.site_settings.bank_transfer_info is '振込先口座 {bank, branch, type, number, holder}';
comment on column public.site_settings.prepay_discounts is 'まとめ払いの割引 {"6": {"type": "percent"|"free_months", "value": n}, "12": {...}}';

update public.site_settings
   set bank_transfer_info = jsonb_build_object(
         'bank', 'ドコモSMTBネット銀行',
         'branch', '法人第一支店（106）',
         'type', '普通',
         'number', '1941725',
         'holder', 'カ）ギブライズ'),
       invoice_registration_number = 'T3170001017239'
 where id = true;

-- 2) 契約・申込みの支払方法 -------------------------------------------------------
alter table public.store_contracts
  add column if not exists billing_method text not null default 'card',
  add column if not exists billing_cycle_months integer not null default 1,
  add column if not exists suspended_for_nonpayment_at timestamptz,
  add column if not exists store_status_before_suspension text;

alter table public.listing_applications
  add column if not exists billing_method text not null default 'card',
  add column if not exists billing_cycle_months integer not null default 1;

do $$ begin
  alter table public.store_contracts add constraint store_contracts_billing_method_check
    check (billing_method in ('card', 'bank_transfer'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.store_contracts add constraint store_contracts_billing_cycle_check
    check (billing_cycle_months in (1, 6, 12));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.listing_applications add constraint listing_applications_billing_method_check
    check (billing_method in ('card', 'bank_transfer'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.listing_applications add constraint listing_applications_billing_cycle_check
    check (billing_cycle_months in (1, 6, 12));
exception when duplicate_object then null; end $$;

-- 3) 請求書 ----------------------------------------------------------------------
create sequence if not exists public.invoice_number_seq;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique
    default ('PS-' || to_char(now() at time zone 'Asia/Tokyo', 'YYYYMM') || '-' ||
             lpad(nextval('public.invoice_number_seq')::text, 5, '0')),
  store_contract_id uuid references public.store_contracts(id) on delete set null,
  listing_application_id uuid references public.listing_applications(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  bill_to_name text not null,
  bill_to_contact text,
  bill_to_email text not null,
  plan_id uuid references public.plans(id) on delete set null,
  plan_name text not null,
  monthly_fee integer not null,
  months integer not null check (months in (1, 6, 12)),
  discount_label text,                                      -- 例: 10%OFF / 2か月分無料
  discount_amount integer not null default 0 check (discount_amount >= 0),
  total_amount integer not null check (total_amount >= 0), -- 税込
  tax_amount integer not null check (tax_amount >= 0),     -- うち消費税(10%)
  period_start date,
  period_end date,
  issued_at timestamptz not null default now(),
  due_date date not null,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'canceled')),
  paid_at timestamptz,
  confirmed_by uuid,
  confirmed_note text,
  reminder_sent_at timestamptz,
  overdue_notified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists invoices_status_due_idx on public.invoices (status, due_date);
create index if not exists invoices_contract_idx on public.invoices (store_contract_id);
create index if not exists invoices_store_idx on public.invoices (store_id);
create index if not exists invoices_application_idx on public.invoices (listing_application_id);

alter table public.invoices enable row level security;

drop policy if exists "admin can manage invoices" on public.invoices;
create policy "admin can manage invoices" on public.invoices
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "store owner can view own invoices" on public.invoices;
create policy "store owner can view own invoices" on public.invoices
  for select using (
    exists (select 1 from public.stores s where s.id = invoices.store_id and s.owner_user_id = auth.uid())
  );

revoke all on public.invoices from anon;
grant select on public.invoices to authenticated;
grant all on public.invoices to service_role;
grant usage on sequence public.invoice_number_seq to service_role, authenticated;

-- 4) 未入金による非公開・振込の入金記録 ----------------------------------------------
-- 店舗の status に 'payment_suspended'(未入金で非公開)を追加。公開側は従来どおり
-- status in ('approved','listed') だけを表示するので、これで店舗ページ・求人・イベント等が
-- まとめて非公開になる。
alter table public.stores drop constraint if exists stores_status_check;
alter table public.stores add constraint stores_status_check
  check (status in ('pending', 'approved', 'rejected', 'listed', 'payment_suspended'));

alter table public.billing_events drop constraint if exists billing_events_source_check;
alter table public.billing_events add constraint billing_events_source_check
  check (source in ('manual', 'fincode_webhook', 'bank_transfer'));

-- 5) 店舗オーナーが運営用の列を書き換えられないようにする ---------------------------
-- RLS「owner can update own store」は行単位なので、公開状態(status)・PICK UP・
-- オーナーなどの列は店舗側から変更できないようトリガーで守る
-- (未入金で非公開にした店舗が自分で公開に戻せないように)。
-- 運営(is_admin)・service-role・SECURITY DEFINER の処理からの変更は対象外
-- (SECURITY INVOKER にして、実際に更新しているロールを current_user で見る)。
create or replace function private.guard_store_admin_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if new.status is distinct from old.status
     or new.is_recommended is distinct from old.is_recommended
     or new.owner_user_id is distinct from old.owner_user_id
     or new.source_application_id is distinct from old.source_application_id then
    raise exception '店舗の公開状態・PICK UP・オーナーは運営のみ変更できます。';
  end if;
  return new;
end
$$;
revoke all on function private.guard_store_admin_columns() from public, anon, authenticated;

drop trigger if exists stores_guard_admin_columns on public.stores;
create trigger stores_guard_admin_columns
  before update on public.stores
  for each row execute function private.guard_store_admin_columns();
