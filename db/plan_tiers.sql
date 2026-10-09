-- 料金プランの3段階化(2026/10)
--   ライトプラン      5,500円 : 店舗基本機能のみ(求人・スポット求人なし)
--   スタンダードプラン 16,500円 : 優良店バッジ(契約1か月以上)、地域一覧で上位表示、
--                                 求人3件まで、スポット求人は月10件の成立まで
--   プレミアムプラン   33,000円 : 優良店バッジ+金枠、地域一覧で最上位表示、
--                                 PICK UP表示(各都道府県10店舗まで)、求人・スポット求人無制限
-- 求人掲載アドオン(11,000円)は廃止。
--
-- プランごとの機能は plans の列で持ち、上限はDBのトリガーで強制する
-- (Web管理画面・LINE(LIFF)・RPCのどこから操作しても同じルールになるように)。
-- 運営(is_admin)の操作は求人・スポット求人の上限の対象外。PICK UPの10店舗上限は運営操作にも適用。

-- 1) プランの機能列 ---------------------------------------------------------
alter table public.plans
  add column if not exists tier smallint not null default 1,
  add column if not exists job_limit integer default 0,            -- null = 無制限
  add column if not exists spot_monthly_limit integer default 0,   -- null = 無制限 / 0 = 利用不可
  add column if not exists list_priority smallint not null default 0, -- 地域一覧の表示順(大きいほど上)
  add column if not exists gold_frame boolean not null default false,
  add column if not exists pickup boolean not null default false,
  add column if not exists badge_after_days integer;                -- null = 優良店バッジなし

comment on column public.plans.job_limit is '同時に募集中にできる求人数。null=無制限';
comment on column public.plans.spot_monthly_limit is 'スポット求人の月間成立数の上限(日本時間の暦月)。null=無制限、0=スポット求人の公開不可';
comment on column public.plans.list_priority is '店舗一覧での表示優先度。大きいほど上に表示';
comment on column public.plans.badge_after_days is '契約開始からこの日数が経過した有効契約に優良店バッジを付与。null=付与しない';

-- 2) 店舗の有効なプラン -----------------------------------------------------
create or replace function private.active_store_plan(p_store_id uuid)
returns table(
  plan_id uuid,
  job_limit integer,
  spot_monthly_limit integer,
  list_priority smallint,
  gold_frame boolean,
  pickup boolean,
  badge_after_days integer,
  contract_started_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.job_limit, p.spot_monthly_limit, p.list_priority, p.gold_frame, p.pickup,
         p.badge_after_days, c.created_at
  from public.store_contracts c
  join public.plans p on p.id = c.plan_id
  where c.store_id = p_store_id and c.status = 'active'
  order by c.created_at desc
  limit 1
$$;
revoke all on function private.active_store_plan(uuid) from public, anon, authenticated;

-- 3) 公開ページ用の表示フラグ(優良店バッジ・金枠・表示順) ---------------------
-- 契約や料金そのものは返さず、公開して問題ない表示用の情報だけを返す。
create or replace function public.store_display_flags(p_store_ids uuid[])
returns table(store_id uuid, list_priority smallint, gold_frame boolean, verified_badge boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.store_id,
         p.list_priority,
         p.gold_frame,
         (p.badge_after_days is not null
           and c.created_at <= now() - make_interval(days => p.badge_after_days)) as verified_badge
  from public.store_contracts c
  join public.plans p on p.id = c.plan_id
  join public.stores s on s.id = c.store_id and s.status in ('approved', 'listed')
  where c.status = 'active'
    and c.store_id = any(p_store_ids)
$$;
revoke all on function public.store_display_flags(uuid[]) from public;
grant execute on function public.store_display_flags(uuid[]) to anon, authenticated, service_role;

-- 4) 求人数の上限 -------------------------------------------------------------
create or replace function private.enforce_job_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has boolean;
  v_limit integer;
  v_count integer;
begin
  if new.status is distinct from 'open' then return new; end if;
  -- すでに募集中の求人の編集は対象外(新規掲載・募集再開だけを数える)
  if tg_op = 'UPDATE' and old.status = 'open' and old.store_id = new.store_id then return new; end if;
  if public.is_admin() then return new; end if;

  select true, ap.job_limit into v_has, v_limit from private.active_store_plan(new.store_id) ap;
  if v_has is null then v_limit := 0; end if;          -- 有効な契約なし
  if v_limit is null then return new; end if;          -- 無制限

  select count(*) into v_count
  from public.jobs
  where store_id = new.store_id and status = 'open' and id <> new.id;

  if v_count >= v_limit then
    if v_limit = 0 then
      raise exception '求人の掲載はスタンダードプラン以上でご利用いただけます。';
    end if;
    raise exception '現在のプランで同時に募集できる求人は%件までです。ほかの求人を募集終了にするか、プランの変更をご検討ください。', v_limit;
  end if;
  return new;
end
$$;

drop trigger if exists jobs_enforce_plan_limit on public.jobs;
create trigger jobs_enforce_plan_limit
  before insert or update of status, store_id on public.jobs
  for each row execute function private.enforce_job_limit();

-- 5) スポット求人の公開可否 -----------------------------------------------------
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

  select true, ap.spot_monthly_limit into v_has, v_limit from private.active_store_plan(new.store_id) ap;
  if v_has is null or v_limit = 0 then
    raise exception 'スポット求人の公開はスタンダードプラン以上でご利用いただけます。';
  end if;
  return new;
end
$$;

drop trigger if exists spot_jobs_enforce_plan on public.spot_jobs;
create trigger spot_jobs_enforce_plan
  before insert or update of published, store_id on public.spot_jobs
  for each row execute function private.enforce_spot_publish();

-- 6) スポット求人の月間成立数の上限 -------------------------------------------
-- 「成立」= 店舗とディーラーの双方が条件確定し、status が confirmed になった時点。
-- 月は日本時間の暦月で数え、確定日時は双方の確定時刻の遅いほう。
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
begin
  if new.status is distinct from 'confirmed' or old.status in ('confirmed', 'completed') then return new; end if;
  if public.is_admin() then return new; end if;

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
    if v_limit = 0 then
      raise exception 'この店舗の現在のプランではスポット求人の勤務を確定できません。';
    end if;
    raise exception 'この店舗は今月のスポット求人の成立上限（%件）に達しているため、勤務を確定できません。', v_limit;
  end if;
  return new;
end
$$;

drop trigger if exists matching_enforce_spot_monthly_limit on public.dealer_matching_records;
create trigger matching_enforce_spot_monthly_limit
  before update of status on public.dealer_matching_records
  for each row execute function private.enforce_spot_monthly_limit();

-- 7) プレミアム = PICK UP表示(各都道府県10店舗まで) ------------------------------
create or replace function private.plan_has_pickup(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce((select pickup from public.plans where id = p_plan_id), false) $$;
revoke all on function private.plan_has_pickup(uuid) from public, anon, authenticated;

create or replace function private.check_pickup_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pref text;
  v_count integer;
begin
  if new.status <> 'active' or not private.plan_has_pickup(new.plan_id) then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'active' and private.plan_has_pickup(old.plan_id)
     and old.store_id = new.store_id then return new; end if;

  select pref into v_pref from public.stores where id = new.store_id;
  select count(*) into v_count
  from public.stores
  where pref is not distinct from v_pref and is_recommended and id <> new.store_id;
  if v_count >= 10 then
    raise exception '%のPICK UP枠（プレミアムプラン）は満枠（10店舗）です。', coalesce(v_pref, 'この地域');
  end if;
  return new;
end
$$;

create or replace function private.sync_pickup_from_contract()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_was boolean := false;
  v_now boolean := false;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_was := old.status = 'active' and private.plan_has_pickup(old.plan_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_now := new.status = 'active' and private.plan_has_pickup(new.plan_id);
  end if;

  if v_now and (not v_was or old.store_id <> new.store_id) then
    update public.stores set is_recommended = true where id = new.store_id;
  end if;
  if v_was and (not v_now or old.store_id <> new.store_id) then
    update public.stores set is_recommended = false where id = old.store_id;
  end if;
  return null;
end
$$;

drop trigger if exists store_contracts_check_pickup on public.store_contracts;
create trigger store_contracts_check_pickup
  before insert or update of status, plan_id, store_id on public.store_contracts
  for each row execute function private.check_pickup_capacity();

drop trigger if exists store_contracts_sync_pickup on public.store_contracts;
create trigger store_contracts_sync_pickup
  after insert or update of status, plan_id, store_id or delete on public.store_contracts
  for each row execute function private.sync_pickup_from_contract();

revoke all on function private.enforce_job_limit() from public, anon, authenticated;
revoke all on function private.enforce_spot_publish() from public, anon, authenticated;
revoke all on function private.enforce_spot_monthly_limit() from public, anon, authenticated;
revoke all on function private.check_pickup_capacity() from public, anon, authenticated;
revoke all on function private.sync_pickup_from_contract() from public, anon, authenticated;

-- 8) プランの登録・求人掲載アドオンの廃止 ------------------------------------------
-- 新プランはコードの本番反映後に active=true にする(機能より先に申込みできないように)。
update public.plans
   set name = 'ライトプラン', tier = 1, job_limit = 0, spot_monthly_limit = 0, list_priority = 0,
       gold_frame = false, pickup = false, badge_after_days = null, sort_order = 1
 where id = 'e58d84ef-f7b5-4762-b4f4-c487cf104481';

insert into public.plans (name, monthly_fee, description, active, sort_order, tier, job_limit, spot_monthly_limit, list_priority, gold_frame, pickup, badge_after_days)
values
  ('スタンダードプラン', 16500,
   E'ライトプランの全機能\n1か月以上の継続で優良店バッジを付与\n該当地域の店舗一覧で上位表示\n求人掲載（3件まで）\nスポット求人（月10件の成立まで）',
   false, 2, 2, 3, 10, 1, false, false, 30),
  ('プレミアムプラン', 33000,
   E'ライトプランの全機能\n1か月以上の継続で優良店バッジを付与\n店舗カードを金枠で表示\n該当地域の店舗一覧で最上位表示\nPICK UP店舗として表示（各都道府県10店舗限定）\n求人・スポット求人ともに無制限',
   false, 3, 3, null, null, 2, true, true, 30);

delete from public.store_contract_addons where addon_id = 'a1000000-0000-4000-8000-000000000001';
delete from public.addons where id = 'a1000000-0000-4000-8000-000000000001';
