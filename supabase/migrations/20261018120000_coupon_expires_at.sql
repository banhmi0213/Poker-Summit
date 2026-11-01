-- クーポンの有効期限は「期限日の、その店舗の営業終了まで」(2026/10/18、ユーザー指示)。
-- coupons.expires_at に、期限日(valid_until)の営業終了の日時を自動で入れる。
-- 営業時間の決め方(上から順に):
--   1. 店舗が入れた営業時間(stores.hours)。「18:00〜翌3:00」「19:00〜25:00」「18:00〜3:00」などの終わりの時刻のうち一番遅いもの。
--      朝6時までの終わりは翌日扱い。「LAST」「ラスト」は翌5:00。「24時間営業」は期限日の24:00。
--   2. Googleマップの営業時間(stores.google_hours_periods)の、期限日の曜日の終わりの時刻。
--   3. どちらも無いときは期限日の24:00(翌0:00)。
-- 店舗の営業時間が変わったら、その店舗のクーポンの expires_at も自動で計算し直す。

alter table public.coupons add column if not exists expires_at timestamptz;

create or replace function private.store_close_minutes(p_store_id uuid, p_day date)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hours text;
  v_periods jsonb;
  v_best integer := null;
  m text[];
  v_min integer;
  v_dow integer := extract(dow from p_day)::integer;
  p jsonb;
  v_open_day integer;
  v_close_day integer;
  v_close_time text;
begin
  select hours, google_hours_periods into v_hours, v_periods from public.stores where id = p_store_id;

  -- 1. 店舗が入れた営業時間
  if coalesce(trim(v_hours), '') <> '' then
    if v_hours ~ '24時間' then
      return 24 * 60;
    end if;
    for m in select regexp_matches(v_hours, '[〜~～\-–]\s*(翌\s*)?(\d{1,2})\s*[:：時]\s*(\d{2})?', 'g') loop
      v_min := (m[2])::integer * 60 + coalesce(nullif(m[3], '')::integer, 0);
      if m[1] is not null and m[1] <> '' then
        v_min := v_min + 24 * 60;
      elsif v_min <= 6 * 60 then
        v_min := v_min + 24 * 60; -- 朝6時までに終わる = 翌日(深夜営業)
      end if;
      if v_best is null or v_min > v_best then v_best := v_min; end if;
    end loop;
    if v_hours ~* '(last|ラスト)' and (v_best is null or v_best < 29 * 60) then
      v_best := 29 * 60; -- 「ラストまで」は翌5:00
    end if;
    if v_best is not null then
      return least(v_best, 30 * 60);
    end if;
  end if;

  -- 2. Googleマップの営業時間(期限日の曜日)
  if v_periods is not null and jsonb_typeof(v_periods) = 'array' then
    for p in select * from jsonb_array_elements(v_periods) loop
      v_open_day := nullif(p #>> '{open,day}', '')::integer;
      v_close_day := nullif(p #>> '{close,day}', '')::integer;
      v_close_time := p #>> '{close,time}';
      if v_open_day = v_dow then
        if v_close_time is null then
          v_min := 24 * 60; -- 終わりが無い = 24時間営業
        else
          v_min := substr(v_close_time, 1, 2)::integer * 60 + substr(v_close_time, 3, 2)::integer;
          if v_close_day is not null and v_close_day <> v_open_day then
            v_min := v_min + 24 * 60 * (((v_close_day - v_open_day) + 7) % 7);
          end if;
        end if;
        if v_best is null or v_min > v_best then v_best := v_min; end if;
      end if;
    end loop;
    if v_best is not null then
      return least(v_best, 30 * 60);
    end if;
  end if;

  -- 3. 分からないときは期限日の24:00
  return 24 * 60;
end;
$$;

create or replace function private.coupon_expires_at(p_valid_until date, p_store_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_valid_until is null then null
    else ((p_valid_until::timestamp + make_interval(mins => private.store_close_minutes(p_store_id, p_valid_until))) at time zone 'Asia/Tokyo')
  end;
$$;

create or replace function private.set_coupon_expires_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.expires_at := private.coupon_expires_at(new.valid_until, new.store_id);
  return new;
end;
$$;

create or replace trigger trg_set_coupon_expires_at
  before insert or update of valid_until, store_id on public.coupons
  for each row execute function private.set_coupon_expires_at();

create or replace function private.refresh_store_coupon_expiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.hours is distinct from old.hours or new.google_hours_periods is distinct from old.google_hours_periods then
    update public.coupons set expires_at = private.coupon_expires_at(valid_until, store_id)
    where store_id = new.id and valid_until is not null;
  end if;
  return new;
end;
$$;

create or replace trigger trg_refresh_store_coupon_expiry
  after update of hours, google_hours_periods on public.stores
  for each row execute function private.refresh_store_coupon_expiry();

-- 既存のクーポンにも入れる
update public.coupons set expires_at = private.coupon_expires_at(valid_until, store_id) where valid_until is not null;

-- クーポンを使う: 期限(営業終了)を過ぎていたら使えない(以前は世界標準時の日付で判定していて、日本時間の朝9時まで使えた)
create or replace function public.use_coupon(p_coupon_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_coupon record;
begin
  if auth.uid() is null then
    raise exception 'login required';
  end if;

  select * into v_coupon from public.coupons where id = p_coupon_id for update;

  if v_coupon is null then
    raise exception 'coupon not found';
  end if;

  if not v_coupon.active then
    raise exception 'coupon is not active';
  end if;

  if v_coupon.valid_until is not null
     and coalesce(v_coupon.expires_at, ((v_coupon.valid_until + 1)::timestamp at time zone 'Asia/Tokyo')) <= now() then
    raise exception 'coupon has expired';
  end if;

  if v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit then
    raise exception 'coupon usage limit reached';
  end if;

  if exists (select 1 from public.coupon_uses where user_id = auth.uid() and coupon_id = p_coupon_id) then
    raise exception 'coupon already used';
  end if;

  insert into public.coupon_uses (user_id, coupon_id) values (auth.uid(), p_coupon_id);

  update public.coupons set used_count = used_count + 1 where id = p_coupon_id;
end;
$function$;
