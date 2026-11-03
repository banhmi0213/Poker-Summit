-- クーポンの使用を「店の近くで使う → 店員さんが使用済みを押す」形にする（2026/11/02 オーナー指示）
-- ・会員がお店で「使う」を押すと、スマホの位置情報で店から300m以内かを確かめる（店側の操作・アカウント・暗証番号は不要）
-- ・画面に店名・特典・動く時刻を出し、店員さんが「使用済みにする」を押して確定する
-- ・使える回数は店ごと（クーポンごと）に選ぶ：お一人様1回／お一人様1日1回／何度でも
-- ・位置は距離（m）だけを記録し、会員の緯度・経度は保存しない

alter table public.coupons
  add column if not exists use_rule text not null default 'once' check (use_rule in ('once', 'daily', 'unlimited'));

alter table public.coupon_uses
  add column if not exists status text not null default 'used' check (status in ('shown', 'used')),
  add column if not exists shown_at timestamptz,
  add column if not exists distance_m integer,
  add column if not exists used_jst_date date;

update public.coupon_uses set used_jst_date = (used_at at time zone 'Asia/Tokyo')::date where used_jst_date is null;

-- 1日1回・何度でもを使えるようにするため、1人1回の一意制約は外す（1回限りは処理側で確かめる）
alter table public.coupon_uses drop constraint if exists coupon_uses_user_id_coupon_id_key;
create index if not exists coupon_uses_user_coupon_status on public.coupon_uses (user_id, coupon_id, status);
create index if not exists coupon_uses_coupon_used_date on public.coupon_uses (coupon_id, used_jst_date) where status = 'used';

-- 位置を確かめずに使用済みにできる旧処理は止める
create or replace function public.use_coupon(p_coupon_id uuid) returns void
language plpgsql security definer set search_path to '' as $$
begin
  raise exception 'location check required';
end $$;

create or replace function public.coupon_distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable set search_path to '' as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- 会員：お店で「使う」。店の近くなら、店員さんに見せる画面のための記録（shown）を作る
create or replace function public.coupon_show(p_coupon_id uuid, p_lat double precision, p_lng double precision, p_accuracy double precision)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  who uuid := auth.uid();
  c record;
  d double precision;
  acc double precision := least(greatest(coalesce(p_accuracy, 0), 0), 150);
  today date := (now() at time zone 'Asia/Tokyo')::date;
  u public.coupon_uses%rowtype;
begin
  if who is null or coalesce(public.is_suspended(), true) then
    return jsonb_build_object('ok', false, 'reason', 'login_required');
  end if;
  select cp.*, s.name as store_name, s.lat as store_lat, s.lng as store_lng, s.status as store_status
    into c
    from public.coupons cp join public.stores s on s.id = cp.store_id
    where cp.id = p_coupon_id;
  if not found or not c.active or c.store_status not in ('approved', 'listed') then
    return jsonb_build_object('ok', false, 'reason', 'not_available');
  end if;
  if c.valid_until is not null
     and coalesce(c.expires_at, ((c.valid_until + 1)::timestamp at time zone 'Asia/Tokyo')) <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  if c.usage_limit is not null and c.used_count >= c.usage_limit then
    return jsonb_build_object('ok', false, 'reason', 'limit_reached');
  end if;
  if c.use_rule = 'once' and exists (select 1 from public.coupon_uses x where x.user_id = who and x.coupon_id = c.id and x.status = 'used') then
    return jsonb_build_object('ok', false, 'reason', 'already_used');
  end if;
  if c.use_rule = 'daily' and exists (select 1 from public.coupon_uses x where x.user_id = who and x.coupon_id = c.id and x.status = 'used' and x.used_jst_date = today) then
    return jsonb_build_object('ok', false, 'reason', 'used_today');
  end if;
  if c.store_lat is null or c.store_lng is null then
    return jsonb_build_object('ok', false, 'reason', 'store_location_unknown');
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    return jsonb_build_object('ok', false, 'reason', 'location_required');
  end if;
  d := public.coupon_distance_m(p_lat, p_lng, c.store_lat, c.store_lng);
  if d - acc > 300 then
    return jsonb_build_object('ok', false, 'reason', 'too_far', 'distance_m', round(d));
  end if;
  -- 30分以内に出した画面があれば使い直す（押し直しで記録が増えないように）
  select * into u from public.coupon_uses x
    where x.user_id = who and x.coupon_id = c.id and x.status = 'shown' and x.shown_at > now() - interval '30 minutes'
    order by x.shown_at desc limit 1 for update;
  if found then
    update public.coupon_uses set shown_at = now(), distance_m = round(d) where id = u.id returning * into u;
  else
    insert into public.coupon_uses (user_id, coupon_id, status, shown_at, used_at, distance_m)
      values (who, c.id, 'shown', now(), now(), round(d)) returning * into u;
  end if;
  return jsonb_build_object('ok', true, 'use_id', u.id, 'store_name', c.store_name, 'title', c.title,
    'discount', c.discount, 'shown_at', u.shown_at);
end $$;

-- 店頭：店員さんが会員のスマホで「使用済みにする」を押す
create or replace function public.coupon_confirm(p_use_id uuid)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  who uuid := auth.uid();
  u public.coupon_uses%rowtype;
  c record;
  today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  if who is null then
    return jsonb_build_object('ok', false, 'reason', 'login_required');
  end if;
  select * into u from public.coupon_uses where id = p_use_id and user_id = who for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if u.status = 'used' then
    return jsonb_build_object('ok', true, 'used_at', u.used_at, 'already', true);
  end if;
  if u.shown_at is null or u.shown_at <= now() - interval '30 minutes' then
    return jsonb_build_object('ok', false, 'reason', 'show_expired');
  end if;
  select cp.*, s.name as store_name into c
    from public.coupons cp join public.stores s on s.id = cp.store_id
    where cp.id = u.coupon_id for update of cp;
  if not c.active then
    return jsonb_build_object('ok', false, 'reason', 'not_available');
  end if;
  if c.usage_limit is not null and c.used_count >= c.usage_limit then
    return jsonb_build_object('ok', false, 'reason', 'limit_reached');
  end if;
  if c.use_rule = 'once' and exists (select 1 from public.coupon_uses x where x.user_id = who and x.coupon_id = c.id and x.status = 'used') then
    return jsonb_build_object('ok', false, 'reason', 'already_used');
  end if;
  if c.use_rule = 'daily' and exists (select 1 from public.coupon_uses x where x.user_id = who and x.coupon_id = c.id and x.status = 'used' and x.used_jst_date = today) then
    return jsonb_build_object('ok', false, 'reason', 'used_today');
  end if;
  update public.coupon_uses set status = 'used', used_at = now(), used_jst_date = today where id = u.id returning * into u;
  update public.coupons set used_count = used_count + 1 where id = c.id;
  return jsonb_build_object('ok', true, 'used_at', u.used_at, 'store_name', c.store_name, 'title', c.title);
end $$;

revoke all on function public.coupon_show(uuid, double precision, double precision, double precision), public.coupon_confirm(uuid),
  public.coupon_distance_m(double precision, double precision, double precision, double precision) from public, anon;
grant execute on function public.coupon_show(uuid, double precision, double precision, double precision), public.coupon_confirm(uuid) to authenticated;
