-- アドオンの刷新(2026/10)
--   月額: 全国TOPページPICKUP 33,000円(全国10店舗) / 地域PICKUP 東京・大阪22,000円・その他11,000円
--         (各都道府県10店舗、店舗の登録住所の都道府県で自動振り分け) / TOPページバナー 100,000円
--   都度: スポット求人1件掲載 2,200円 / 店舗紹介記事or動画作成 10,000円 /
--         ライター来店+記事作成 50,000円 / YouTube撮影+動画投稿 100,000円
-- 支払いはカード・銀行振込のどちらでも可。
-- プレミアムプランのPICK UP表示は廃止し、PICK UPはアドオンだけで付ける。

-- 1) アドオンの種類 ---------------------------------------------------------------
alter table public.addons
  add column if not exists code text,
  add column if not exists billing_type text not null default 'monthly',
  add column if not exists capacity integer,              -- 同時に契約できる店舗数(null=無制限)
  add column if not exists capacity_scope text,           -- 'pref'=都道府県ごと / 'national'=全国
  add column if not exists major_area_fee integer,        -- 東京・大阪の料金(null=全国一律)
  add column if not exists major_area_prefs text[] not null default array['東京都', '大阪府'],
  add column if not exists needs_fulfillment boolean not null default false; -- 運営の対応(制作・設定)が必要

do $$ begin
  alter table public.addons add constraint addons_billing_type_check check (billing_type in ('monthly', 'one_time'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.addons add constraint addons_capacity_scope_check check (capacity_scope in ('pref', 'national'));
exception when duplicate_object then null; end $$;
create unique index if not exists addons_code_key on public.addons (code) where code is not null;

update public.addons set active = false where code is null;

insert into public.addons (code, name, monthly_fee, major_area_fee, description, billing_type, capacity, capacity_scope, needs_fulfillment, active, sort_order)
values
  ('pickup_national', '全国TOPページPICKUP店舗表示', 33000, null,
   'TOPページのPICK UP店舗に、閲覧者の地域に関係なく全国で表示します（全国10店舗限定）。', 'monthly', 10, 'national', false, true, 10),
  ('pickup_region', '地域PICKUP店舗表示', 11000, 22000,
   '登録住所の都道府県のPICK UP店舗として表示します（各都道府県10店舗限定）。', 'monthly', 10, 'pref', false, true, 20),
  ('top_banner', 'TOPページバナー', 110000, null,
   'TOPページのメインバナーに店舗のバナーを掲載します（3枠限定）。バナー画像は運営と調整のうえ設定します。', 'monthly', 3, 'national', true, true, 30),
  ('spot_job_credit', 'スポット求人1件掲載', 2200, null,
   'スポット求人を1件追加で掲載できます。ライトプランでも掲載でき、スタンダードプランの月間上限を超えた分にも使えます。', 'one_time', null, null, false, true, 40),
  ('article_or_video', '店舗紹介記事or店舗紹介動画作成', 11000, null,
   '店舗紹介の記事、または店舗紹介動画を制作して掲載します。', 'one_time', null, null, true, true, 50),
  ('writer_visit', 'ライター来店+記事作成', 55000, null,
   'ライターが来店して取材し、記事を作成・掲載します。日程は運営からご連絡します。', 'one_time', null, null, true, true, 60),
  ('youtube', 'YouTube撮影+動画投稿', 110000, null,
   '店舗で撮影を行い、YouTubeに動画を投稿します。日程は運営からご連絡します。', 'one_time', null, null, true, true, 70)
on conflict (code) where code is not null do update
  set name = excluded.name, monthly_fee = excluded.monthly_fee, major_area_fee = excluded.major_area_fee,
      description = excluded.description, billing_type = excluded.billing_type, capacity = excluded.capacity,
      capacity_scope = excluded.capacity_scope, needs_fulfillment = excluded.needs_fulfillment,
      active = true, sort_order = excluded.sort_order;

-- 2) 契約中の月額アドオン ----------------------------------------------------------
alter table public.store_contract_addons
  add column if not exists fee integer,                         -- 契約時の月額(地域で変わるので固定して持つ)
  add column if not exists billing_method text not null default 'card',
  add column if not exists current_period_end timestamptz;      -- 振込で払うアドオンの期間(次の請求期間の始まり)
do $$ begin
  alter table public.store_contract_addons add constraint store_contract_addons_billing_method_check
    check (billing_method in ('card', 'bank_transfer'));
exception when duplicate_object then null; end $$;

-- 3) アドオンの注文(都度払い・振込での月額の申込み) --------------------------------
create table if not exists public.addon_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  store_contract_id uuid references public.store_contracts(id) on delete set null,
  addon_id uuid references public.addons(id) on delete set null,
  addon_code text,
  addon_name text not null,
  billing_type text not null check (billing_type in ('monthly', 'one_time')),
  quantity integer not null default 1 check (quantity between 1 and 100),
  unit_price integer not null check (unit_price >= 0),
  total_amount integer not null check (total_amount >= 0),
  payment_method text not null check (payment_method in ('card', 'bank_transfer')),
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'paid', 'in_progress', 'completed', 'canceled')),
  invoice_id uuid references public.invoices(id) on delete set null,
  fincode_order_id text,
  note text,          -- 店舗からの連絡事項
  admin_note text,    -- 運営メモ
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  completed_at timestamptz
);
create index if not exists addon_orders_store_idx on public.addon_orders (store_id, created_at desc);
create index if not exists addon_orders_status_idx on public.addon_orders (status);
alter table public.addon_orders enable row level security;
drop policy if exists "admin can manage addon orders" on public.addon_orders;
create policy "admin can manage addon orders" on public.addon_orders
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "store owner can view own addon orders" on public.addon_orders;
create policy "store owner can view own addon orders" on public.addon_orders
  for select using (exists (select 1 from public.stores s where s.id = addon_orders.store_id and s.owner_user_id = auth.uid()));
revoke all on public.addon_orders from anon;
grant select on public.addon_orders to authenticated;
grant all on public.addon_orders to service_role;

-- 4) 請求書の明細(アドオンの請求に使う) --------------------------------------------
alter table public.invoices
  add column if not exists kind text not null default 'plan',
  add column if not exists items jsonb,                 -- [{label, sub, quantity, unit_price, amount}]
  add column if not exists addon_order_id uuid references public.addon_orders(id) on delete set null,
  add column if not exists store_contract_addon_id uuid references public.store_contract_addons(id) on delete set null;
do $$ begin
  alter table public.invoices add constraint invoices_kind_check check (kind in ('plan', 'addon'));
exception when duplicate_object then null; end $$;

-- 5) スポット求人の追加掲載枠 ------------------------------------------------------
create table if not exists public.store_spot_credits (
  store_id uuid primary key references public.stores(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
alter table public.store_spot_credits enable row level security;
drop policy if exists "admin can manage spot credits" on public.store_spot_credits;
create policy "admin can manage spot credits" on public.store_spot_credits
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "store owner can view own spot credits" on public.store_spot_credits;
create policy "store owner can view own spot credits" on public.store_spot_credits
  for select using (exists (select 1 from public.stores s where s.id = store_spot_credits.store_id and s.owner_user_id = auth.uid()));
revoke all on public.store_spot_credits from anon;
grant select on public.store_spot_credits to authenticated;
grant all on public.store_spot_credits to service_role;

alter table public.spot_jobs add column if not exists credit_used boolean not null default false;

-- 枠を1つ使う(残りがなければ false)
create or replace function private.use_spot_credit(p_store_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_rows integer;
begin
  update public.store_spot_credits set balance = balance - 1, updated_at = now()
   where store_id = p_store_id and balance > 0;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end
$$;
revoke all on function private.use_spot_credit(uuid) from public, anon, authenticated;

-- 公開: プランで公開できない(ライト等)場合は、追加掲載枠を1つ使って公開できる
create or replace function private.enforce_spot_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has boolean;
  v_limit integer;
begin
  if not new.published then return new; end if;
  if tg_op = 'UPDATE' and old.published and old.store_id = new.store_id then return new; end if;
  if public.is_admin() then return new; end if;
  if new.credit_used then return new; end if;

  select true, ap.spot_monthly_limit into v_has, v_limit from private.active_store_plan(new.store_id) ap;
  if v_has is null or v_limit = 0 then
    if private.use_spot_credit(new.store_id) then
      new.credit_used := true;
      return new;
    end if;
    raise exception 'スポット求人の公開はスタンダードプラン以上、または「スポット求人1件掲載」の追加でご利用いただけます。';
  end if;
  return new;
end
$$;

-- 成立: 月間上限を超える場合は、その求人が追加掲載枠で出したものか、枠が残っていれば成立できる
create or replace function private.enforce_spot_monthly_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has boolean;
  v_limit integer;
  v_count integer;
  v_month_start timestamptz;
  v_credit boolean := false;
begin
  if new.status is distinct from 'confirmed' or old.status in ('confirmed', 'completed') then return new; end if;
  if public.is_admin() then return new; end if;

  if new.spot_job_id is not null then
    select credit_used into v_credit from public.spot_jobs where id = new.spot_job_id;
    if coalesce(v_credit, false) then return new; end if; -- 追加掲載枠で出した求人
  end if;

  select true, ap.spot_monthly_limit into v_has, v_limit from private.active_store_plan(new.store_id) ap;
  if v_has is null then v_limit := 0; end if;
  if v_limit is null then return new; end if;

  v_month_start := (date_trunc('month', now() at time zone 'Asia/Tokyo')) at time zone 'Asia/Tokyo';
  select count(*) into v_count
  from public.dealer_matching_records
  where store_id = new.store_id
    and id <> new.id
    and status in ('confirmed', 'completed')
    and greatest(store_confirmed_at, dealer_confirmed_at) >= v_month_start;

  if v_count >= v_limit then
    if new.spot_job_id is not null and private.use_spot_credit(new.store_id) then
      update public.spot_jobs set credit_used = true where id = new.spot_job_id;
      return new;
    end if;
    if v_limit = 0 then
      raise exception 'この店舗の現在のプランではスポット求人の勤務を確定できません。「スポット求人1件掲載」を追加するとご利用いただけます。';
    end if;
    raise exception 'この店舗は今月のスポット求人の成立上限（%件）に達しています。「スポット求人1件掲載」を追加すると、上限を超えて確定できます。', v_limit;
  end if;
  return new;
end
$$;

-- 6) PICK UP をアドオン基準に ------------------------------------------------------
alter table public.stores add column if not exists is_national_pickup boolean not null default false;

-- プランのPICK UPを廃止(プレミアムからも外す)
update public.plans set pickup = false where pickup;
update public.plans
   set description = replace(description, E'\nPICK UP店舗として表示（各都道府県10店舗限定）', '')
 where description like '%PICK UP店舗として表示%';

drop trigger if exists store_contracts_check_pickup on public.store_contracts;
drop trigger if exists store_contracts_sync_pickup on public.store_contracts;

-- 店舗のPICK UP表示を、有効な契約の月額アドオンから付け直す
create or replace function private.sync_store_pickup(p_store_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_region boolean;
  v_national boolean;
begin
  select
    coalesce(bool_or(a.code = 'pickup_region'), false),
    coalesce(bool_or(a.code = 'pickup_national'), false)
  into v_region, v_national
  from public.store_contracts c
  join public.store_contract_addons sca on sca.store_contract_id = c.id
  join public.addons a on a.id = sca.addon_id
  where c.store_id = p_store_id and c.status = 'active';

  update public.stores
     set is_recommended = v_region, is_national_pickup = v_national
   where id = p_store_id
     and (is_recommended is distinct from v_region or is_national_pickup is distinct from v_national);
end
$$;
revoke all on function private.sync_store_pickup(uuid) from public, anon, authenticated;

-- 枠の上限(都道府県ごと / 全国)
create or replace function private.check_addon_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_addon record;
  v_store_id uuid;
  v_pref text;
  v_count integer;
begin
  select code, name, capacity, capacity_scope into v_addon from public.addons where id = new.addon_id;
  if v_addon.capacity is null then return new; end if;
  if tg_op = 'UPDATE' and old.addon_id = new.addon_id and old.store_contract_id = new.store_contract_id then return new; end if;

  select c.store_id, s.pref into v_store_id, v_pref
  from public.store_contracts c join public.stores s on s.id = c.store_id
  where c.id = new.store_contract_id;

  select count(distinct c.store_id) into v_count
  from public.store_contract_addons sca
  join public.store_contracts c on c.id = sca.store_contract_id and c.status = 'active'
  join public.stores s on s.id = c.store_id
  where sca.addon_id = new.addon_id
    and c.store_id <> v_store_id
    and (v_addon.capacity_scope is distinct from 'pref' or s.pref is not distinct from v_pref);

  if v_count >= v_addon.capacity then
    if v_addon.capacity_scope = 'pref' then
      raise exception '%の「%」は満枠（%店舗）です。', coalesce(v_pref, 'この地域'), v_addon.name, v_addon.capacity;
    end if;
    raise exception '「%」は満枠（全国%店舗）です。', v_addon.name, v_addon.capacity;
  end if;
  return new;
end
$$;
revoke all on function private.check_addon_capacity() from public, anon, authenticated;

drop trigger if exists store_contract_addons_check_capacity on public.store_contract_addons;
create trigger store_contract_addons_check_capacity
  before insert or update of addon_id, store_contract_id on public.store_contract_addons
  for each row execute function private.check_addon_capacity();

create or replace function private.sync_pickup_from_addons()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_store uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select store_id into v_store from public.store_contracts where id = old.store_contract_id;
    if v_store is not null then perform private.sync_store_pickup(v_store); end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select store_id into v_store from public.store_contracts where id = new.store_contract_id;
    if v_store is not null then perform private.sync_store_pickup(v_store); end if;
  end if;
  return null;
end
$$;
revoke all on function private.sync_pickup_from_addons() from public, anon, authenticated;

drop trigger if exists store_contract_addons_sync_pickup on public.store_contract_addons;
create trigger store_contract_addons_sync_pickup
  after insert or update or delete on public.store_contract_addons
  for each row execute function private.sync_pickup_from_addons();

create or replace function private.sync_pickup_from_contract_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform private.sync_store_pickup(old.store_id); end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.store_id <> old.store_id) then
    perform private.sync_store_pickup(new.store_id);
  end if;
  return null;
end
$$;
revoke all on function private.sync_pickup_from_contract_status() from public, anon, authenticated;

drop trigger if exists store_contracts_sync_pickup_addons on public.store_contracts;
create trigger store_contracts_sync_pickup_addons
  after insert or update of status, store_id or delete on public.store_contracts
  for each row execute function private.sync_pickup_from_contract_status();

-- 既存の店舗を付け直す(プレミアムで付いていたPICK UPはここで外れる)
do $$
declare r record;
begin
  for r in select id from public.stores where is_recommended or is_national_pickup
           union select c.store_id from public.store_contracts c loop
    perform private.sync_store_pickup(r.id);
  end loop;
end $$;

-- 店舗オーナーが全国PICK UPを書き換えられないように(既存のガードに追加)
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
     or new.is_national_pickup is distinct from old.is_national_pickup
     or new.owner_user_id is distinct from old.owner_user_id
     or new.source_application_id is distinct from old.source_application_id then
    raise exception '店舗の公開状態・PICK UP・オーナーは運営のみ変更できます。';
  end if;
  return new;
end
$$;
