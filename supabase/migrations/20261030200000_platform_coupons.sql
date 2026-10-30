-- PokerSummit発行クーポン（2026/10/30 オーナー指示）
-- 会員がゲームのチップで交換 → 参加店で使用 → 月末に店ごとの使用数を集計して、運営が店に支払う。
-- ・クーポンの種類：ドリンク無料／リングチップ◯円分／エントリー費／エントランス無料（中身は店ごと）
-- ・同じ店で、1人1種類につき1日1回まで（日本時間）
-- ・店舗アカウントのない店でも使えるよう、使用済みにするのは「店員が会員のスマホで店の暗証番号を入れる」方式。
--   店舗アカウントのある店は、管理画面からクーポン番号で使用済みにもできる。
-- ・チップの引き落としはゲームのショップ交換（poker_private.shop_exchange）と同じ扱い（ring_accounts.available を減らす）。

create schema if not exists coupon_private;
revoke all on schema coupon_private from public, anon, authenticated;

-- 参加店（掲載の有無は問わない）
create table if not exists coupon_private.stores (
  store_id uuid primary key references public.stores(id) on delete cascade,
  active boolean not null default true,
  pin_hash text not null,
  contact_note text,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 店ごとのクーポン（1店につき種類ごとに1つ）
create table if not exists coupon_private.offers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references coupon_private.stores(store_id) on delete cascade,
  kind text not null check (kind in ('drink_free','ring_chips','entry_fee','entrance_free')),
  title text not null check (length(title) between 1 and 60),
  payout_yen integer not null check (payout_yen >= 0),
  chip_cost bigint not null check (chip_cost > 0),
  monthly_limit integer check (monthly_limit is null or monthly_limit > 0),
  valid_days integer not null default 7 check (valid_days between 1 and 60),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, kind)
);

-- 交換したクーポン（＝台帳。消さない）
create table if not exists coupon_private.redemptions (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references coupon_private.offers(id),
  store_id uuid not null references coupon_private.stores(store_id),
  member_id uuid not null references auth.users(id),
  request_id uuid not null,
  kind text not null,
  title text not null,
  payout_yen integer not null,
  chip_cost bigint not null,
  code text not null unique,
  status text not null default 'issued' check (status in ('issued','used','cancelled')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_jst_date date,
  used_via text check (used_via in ('pin','store_account','admin')),
  used_by uuid,
  pin_failures integer not null default 0,
  unique (member_id, request_id)
);
-- 同じ店で1人1種類につき1日1回まで
create unique index if not exists redemptions_one_use_per_day
  on coupon_private.redemptions (member_id, store_id, kind, used_jst_date) where status = 'used';
-- 未使用のクーポンは、同じ店の同じ種類につき1枚まで
create unique index if not exists redemptions_one_open
  on coupon_private.redemptions (member_id, offer_id) where status = 'issued';
create index if not exists redemptions_store_used on coupon_private.redemptions (store_id, used_at) where status = 'used';

-- 月ごとの支払い
create table if not exists coupon_private.payouts (
  store_id uuid not null references coupon_private.stores(store_id),
  month date not null check (extract(day from month) = 1),
  uses integer not null,
  amount_yen integer not null,
  status text not null default 'pending' check (status in ('pending','paid')),
  closed_at timestamptz not null default now(),
  paid_at timestamptz,
  note text,
  primary key (store_id, month)
);

revoke all on all tables in schema coupon_private from public, anon, authenticated;

create or replace function coupon_private.jst_today() returns date language sql stable set search_path to '' as
$$ select (now() at time zone 'Asia/Tokyo')::date $$;

create or replace function coupon_private.new_code() returns text language plpgsql volatile set search_path to '' as $$
declare c text;
begin
  loop
    c := upper(substr(translate(encode(extensions.gen_random_bytes(8), 'base64'), '+/=0O1Il', ''), 1, 8));
    exit when length(c) = 8 and not exists (select 1 from coupon_private.redemptions where code = c);
  end loop;
  return c;
end $$;

create or replace function coupon_private.coupon_json(r coupon_private.redemptions) returns jsonb language sql stable set search_path to '' as $$
  select jsonb_build_object(
    'id', r.id, 'code', r.code, 'store_id', r.store_id,
    'store_name', (select s.name from public.stores s where s.id = r.store_id),
    'kind', r.kind, 'title', r.title, 'chip_cost', r.chip_cost,
    'status', case when r.status = 'issued' and r.expires_at <= now() then 'expired' else r.status end,
    'issued_at', r.issued_at, 'expires_at', r.expires_at, 'used_at', r.used_at)
$$;

-- 会員：交換できるクーポン一覧
create or replace function public.coupon_offers(p_pref text default null) returns jsonb
language sql stable security definer set search_path to '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'offer_id', o.id, 'store_id', o.store_id, 'store_name', s.name, 'pref', s.pref, 'city', s.city,
      'kind', o.kind, 'title', o.title, 'chip_cost', o.chip_cost, 'valid_days', o.valid_days,
      'sold_out', (o.monthly_limit is not null and (
         select count(*) from coupon_private.redemptions r
         where r.offer_id = o.id and r.status in ('issued','used')
           and (r.issued_at at time zone 'Asia/Tokyo') >= date_trunc('month', now() at time zone 'Asia/Tokyo')) >= o.monthly_limit)
    ) order by s.pref, s.name, o.kind), '[]'::jsonb)
  from coupon_private.offers o
  join coupon_private.stores cs on cs.store_id = o.store_id and cs.active
  join public.stores s on s.id = o.store_id and s.status in ('approved','listed')
  where o.active and (o.starts_at is null or o.starts_at <= now()) and (o.ends_at is null or o.ends_at > now())
    and (p_pref is null or s.pref = p_pref)
$$;

-- 会員：チップでクーポンに交換（同じ request_id の再送は同じ結果を返す）
create or replace function public.coupon_exchange(p_offer uuid, p_request uuid) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare who uuid := auth.uid(); o coupon_private.offers%rowtype; a poker_private.ring_accounts%rowtype;
        prior coupon_private.redemptions%rowtype; r coupon_private.redemptions%rowtype; used_this_month integer;
begin
  if who is null or coalesce(public.is_suspended(), true) then raise exception 'Login required'; end if;
  if p_offer is null or p_request is null then raise exception 'Invalid exchange'; end if;
  select * into prior from coupon_private.redemptions where member_id = who and request_id = p_request;
  if found then
    if prior.offer_id <> p_offer then raise exception 'Request conflict'; end if;
    return coupon_private.coupon_json(prior);
  end if;
  select o2.* into o from coupon_private.offers o2
    join coupon_private.stores cs on cs.store_id = o2.store_id and cs.active
    join public.stores s on s.id = o2.store_id and s.status in ('approved','listed')
    where o2.id = p_offer and o2.active and (o2.starts_at is null or o2.starts_at <= now()) and (o2.ends_at is null or o2.ends_at > now())
    for update of o2;
  if not found then raise exception 'Coupon unavailable'; end if;
  if exists (select 1 from coupon_private.redemptions where member_id = who and offer_id = o.id and status = 'issued' and expires_at > now()) then
    raise exception 'Already have this coupon';
  end if;
  if o.monthly_limit is not null then
    select count(*) into used_this_month from coupon_private.redemptions
      where offer_id = o.id and status in ('issued','used')
        and (issued_at at time zone 'Asia/Tokyo') >= date_trunc('month', now() at time zone 'Asia/Tokyo');
    if used_this_month >= o.monthly_limit then raise exception 'Sold out this month'; end if;
  end if;
  -- 期限切れの未使用クーポンは取り消し扱いにして、同じ種類をもう一度交換できるようにする
  update coupon_private.redemptions set status = 'cancelled' where member_id = who and offer_id = o.id and status = 'issued' and expires_at <= now();
  perform poker_private.ensure_ring_welcome(who);
  select * into a from poker_private.ring_accounts where member_id = who for update;
  if not found then raise exception 'Account unavailable'; end if;
  if a.available < o.chip_cost then raise exception 'Insufficient chips'; end if;
  update poker_private.ring_accounts set available = available - o.chip_cost, updated_at = now() where member_id = who;
  insert into coupon_private.redemptions (offer_id, store_id, member_id, request_id, kind, title, payout_yen, chip_cost, code, expires_at)
    values (o.id, o.store_id, who, p_request, o.kind, o.title, o.payout_yen, o.chip_cost, coupon_private.new_code(), now() + make_interval(days => o.valid_days))
    returning * into r;
  return coupon_private.coupon_json(r);
end $$;

-- 会員：自分のクーポン
create or replace function public.coupon_mine() returns jsonb
language sql stable security definer set search_path to '' as $$
  select coalesce(jsonb_agg(coupon_private.coupon_json(r) order by r.issued_at desc), '[]'::jsonb)
  from coupon_private.redemptions r where r.member_id = auth.uid()
$$;

-- 使用済みにする共通処理
create or replace function coupon_private.mark_used(r coupon_private.redemptions, p_via text, p_by uuid) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare done coupon_private.redemptions%rowtype;
begin
  if r.status <> 'issued' then raise exception 'Coupon already used or cancelled'; end if;
  if r.expires_at <= now() then raise exception 'Coupon expired'; end if;
  if exists (select 1 from coupon_private.redemptions x where x.member_id = r.member_id and x.store_id = r.store_id
               and x.kind = r.kind and x.status = 'used' and x.used_jst_date = coupon_private.jst_today()) then
    raise exception 'Already used this kind at this store today';
  end if;
  update coupon_private.redemptions set status = 'used', used_at = now(), used_jst_date = coupon_private.jst_today(), used_via = p_via, used_by = p_by
    where id = r.id returning * into done;
  return coupon_private.coupon_json(done);
end $$;

-- 店頭：会員のスマホで、店員が店の暗証番号を入れて使用済みにする（5回間違えたらそのクーポンはロック）
create or replace function public.coupon_use_with_pin(p_coupon uuid, p_pin text) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare who uuid := auth.uid(); r coupon_private.redemptions%rowtype; h text;
begin
  if who is null then raise exception 'Login required'; end if;
  select * into r from coupon_private.redemptions where id = p_coupon and member_id = who for update;
  if not found then raise exception 'Coupon not found'; end if;
  if r.pin_failures >= 5 then raise exception 'Too many wrong PINs'; end if;
  select pin_hash into h from coupon_private.stores where store_id = r.store_id and active;
  if h is null or p_pin is null or extensions.crypt(p_pin, h) <> h then
    update coupon_private.redemptions set pin_failures = pin_failures + 1 where id = r.id;
    return jsonb_build_object('ok', false, 'error', 'Wrong PIN', 'remaining', greatest(0, 4 - r.pin_failures));
  end if;
  return jsonb_build_object('ok', true, 'coupon', coupon_private.mark_used(r, 'pin', null));
end $$;

-- 店舗管理画面：クーポン番号で使用済みにする（店舗アカウントのある店）
create or replace function public.coupon_store_use(p_code text) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare who uuid := auth.uid(); r coupon_private.redemptions%rowtype;
begin
  if who is null then raise exception 'Login required'; end if;
  select x.* into r from coupon_private.redemptions x join public.stores s on s.id = x.store_id
    where x.code = upper(trim(p_code)) and s.owner_user_id = who for update of x;
  if not found then raise exception 'Coupon not found for your store'; end if;
  return coupon_private.mark_used(r, 'store_account', who);
end $$;

-- 店舗管理画面：自店の使用履歴（会員の個人情報は返さない）
create or replace function public.coupon_store_history(p_month date default null) returns jsonb
language sql stable security definer set search_path to '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', r.code, 'title', r.title, 'used_at', r.used_at) order by r.used_at desc), '[]'::jsonb)
  from coupon_private.redemptions r join public.stores s on s.id = r.store_id
  where s.owner_user_id = auth.uid() and r.status = 'used'
    and r.used_jst_date >= coalesce(p_month, date_trunc('month', coupon_private.jst_today())::date)
    and r.used_jst_date < (coalesce(p_month, date_trunc('month', coupon_private.jst_today())::date) + interval '1 month')
$$;

-- 運営：参加店の登録・暗証番号の設定
create or replace function public.coupon_admin_store_save(p_store uuid, p_active boolean, p_pin text default null, p_note text default null) returns jsonb
language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  if p_pin is not null and p_pin !~ '^[0-9]{4,8}$' then raise exception 'PIN must be 4-8 digits'; end if;
  if not exists (select 1 from coupon_private.stores where store_id = p_store) and p_pin is null then raise exception 'PIN required for a new store'; end if;
  insert into coupon_private.stores (store_id, active, pin_hash, contact_note)
    values (p_store, p_active, extensions.crypt(coalesce(p_pin, ''), extensions.gen_salt('bf')), p_note)
  on conflict (store_id) do update set active = excluded.active,
    pin_hash = case when p_pin is null then coupon_private.stores.pin_hash else excluded.pin_hash end,
    contact_note = coalesce(p_note, coupon_private.stores.contact_note), updated_at = now();
  return jsonb_build_object('store_id', p_store, 'active', p_active);
end $$;

-- 運営：店のクーポンを登録・変更
create or replace function public.coupon_admin_offer_save(p_store uuid, p_kind text, p_title text, p_payout_yen integer, p_chip_cost bigint,
  p_monthly_limit integer default null, p_valid_days integer default 7, p_active boolean default true) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare o coupon_private.offers%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  insert into coupon_private.offers (store_id, kind, title, payout_yen, chip_cost, monthly_limit, valid_days, active)
    values (p_store, p_kind, p_title, p_payout_yen, p_chip_cost, p_monthly_limit, p_valid_days, p_active)
  on conflict (store_id, kind) do update set title = excluded.title, payout_yen = excluded.payout_yen, chip_cost = excluded.chip_cost,
    monthly_limit = excluded.monthly_limit, valid_days = excluded.valid_days, active = excluded.active, updated_at = now()
  returning * into o;
  return to_jsonb(o);
end $$;

-- 運営：月の集計（支払い前の確認用。p_month は月初日）
create or replace function public.coupon_admin_month(p_month date) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('store_id', t.store_id, 'store_name', t.store_name, 'uses', t.uses, 'amount_yen', t.amount_yen, 'by_kind', t.by_kind) order by t.amount_yen desc), '[]'::jsonb)
    from (
      select k.store_id, s.name as store_name, sum(k.n)::integer as uses, sum(k.yen)::integer as amount_yen,
             jsonb_object_agg(k.kind, jsonb_build_object('uses', k.n, 'amount_yen', k.yen)) as by_kind
      from (select r.store_id, r.kind, count(*) as n, sum(r.payout_yen) as yen
            from coupon_private.redemptions r
            where r.status = 'used' and r.used_jst_date >= p_month and r.used_jst_date < (p_month + interval '1 month')
            group by r.store_id, r.kind) k
      join public.stores s on s.id = k.store_id
      group by k.store_id, s.name) t);
end $$;

-- 運営：月を締めて支払い一覧を作る（何度実行しても同じ結果。支払い済みの行は変えない）
create or replace function public.coupon_admin_close_month(p_month date) returns jsonb
language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  if extract(day from p_month) <> 1 then raise exception 'Use the first day of the month'; end if;
  insert into coupon_private.payouts (store_id, month, uses, amount_yen)
    select r.store_id, p_month, count(*), sum(r.payout_yen)
    from coupon_private.redemptions r
    where r.status = 'used' and r.used_jst_date >= p_month and r.used_jst_date < (p_month + interval '1 month')
    group by r.store_id
  on conflict (store_id, month) do update set uses = excluded.uses, amount_yen = excluded.amount_yen, closed_at = now()
    where coupon_private.payouts.status = 'pending';
  return (select coalesce(jsonb_agg(jsonb_build_object('store_id', p.store_id, 'store_name', s.name, 'uses', p.uses, 'amount_yen', p.amount_yen, 'status', p.status) order by p.amount_yen desc), '[]'::jsonb)
          from coupon_private.payouts p join public.stores s on s.id = p.store_id where p.month = p_month);
end $$;

-- 運営：支払い済みにする
create or replace function public.coupon_admin_mark_paid(p_store uuid, p_month date, p_note text default null) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare p coupon_private.payouts%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  update coupon_private.payouts set status = 'paid', paid_at = now(), note = coalesce(p_note, note)
    where store_id = p_store and month = p_month and status = 'pending' returning * into p;
  if not found then raise exception 'No pending payout'; end if;
  return to_jsonb(p);
end $$;

revoke all on function public.coupon_offers(text), public.coupon_exchange(uuid, uuid), public.coupon_mine(),
  public.coupon_use_with_pin(uuid, text), public.coupon_store_use(text), public.coupon_store_history(date),
  public.coupon_admin_store_save(uuid, boolean, text, text), public.coupon_admin_offer_save(uuid, text, text, integer, bigint, integer, integer, boolean),
  public.coupon_admin_month(date), public.coupon_admin_close_month(date), public.coupon_admin_mark_paid(uuid, date, text) from public, anon;
revoke all on all functions in schema coupon_private from public, anon, authenticated;
grant execute on function public.coupon_offers(text) to anon, authenticated;
grant execute on function public.coupon_exchange(uuid, uuid), public.coupon_mine(), public.coupon_use_with_pin(uuid, text),
  public.coupon_store_use(text), public.coupon_store_history(date),
  public.coupon_admin_store_save(uuid, boolean, text, text), public.coupon_admin_offer_save(uuid, text, text, integer, bigint, integer, integer, boolean),
  public.coupon_admin_month(date), public.coupon_admin_close_month(date), public.coupon_admin_mark_paid(uuid, date, text) to authenticated;
