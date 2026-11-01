-- スポット求人とスカウトの回数(2026/10/22 オーナー指示)
--  ・プランの枠(スタンダード月10回)は「スポット求人を1件公開＝1回」「スカウトで1人に1日オファー＝1回」で減らす
--    (同じディーラーに3日頼めば3回)。勤務の成立では数えない。
--  ・プランの枠を使い切ったら、スポット求人は「スポット求人1件掲載」、スカウトは「ディーラースカウト」の購入分を使う
--  ・プレミアム(無制限)はどちらも無制限
--  ・スポット求人の勤務日は、公開するとき今日〜2日後(日本時間)まで
create table if not exists public.store_quota_uses (
  id bigint generated always as identity primary key,
  store_id uuid not null,
  kind text not null check (kind in ('spot', 'scout')),
  ref_id uuid not null,
  source text not null check (source in ('plan', 'credit', 'unlimited')),
  created_at timestamptz not null default now(),
  unique (kind, ref_id)
);
alter table public.store_quota_uses enable row level security;
revoke all on public.store_quota_uses from anon, authenticated;
create index if not exists store_quota_uses_store_month on public.store_quota_uses (store_id, created_at);

-- 今月プランの枠を何回使ったか(日本時間の月初から)
create or replace function public.store_plan_quota_used(p_store_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.store_quota_uses
  where store_id = p_store_id and source = 'plan'
    and created_at >= (date_trunc('month', now() at time zone 'Asia/Tokyo')) at time zone 'Asia/Tokyo'
    and (public.is_admin() or exists (select 1 from public.stores s where s.id = p_store_id and s.owner_user_id = auth.uid()));
$$;
revoke all on function public.store_plan_quota_used(uuid) from public, anon;
grant execute on function public.store_plan_quota_used(uuid) to authenticated;

-- プランの枠を1回使う。'unlimited' / 'plan' を返し、使えなければ null
create or replace function private.use_plan_quota(p_store_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_has boolean; v_limit integer; v_used integer;
begin
  perform pg_advisory_xact_lock(hashtext('plan_quota:' || p_store_id::text));
  select true, ap.spot_monthly_limit into v_has, v_limit from private.active_store_plan(p_store_id) ap;
  if v_has is null then return null; end if;
  if v_limit is null then return 'unlimited'; end if;
  if v_limit <= 0 then return null; end if;
  select count(*) into v_used from public.store_quota_uses
   where store_id = p_store_id and source = 'plan'
     and created_at >= (date_trunc('month', now() at time zone 'Asia/Tokyo')) at time zone 'Asia/Tokyo';
  if v_used < v_limit then return 'plan'; end if;
  return null;
end $$;

-- スポット求人の公開
create or replace function private.enforce_spot_publish()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_src text;
begin
  if not new.published then return new; end if;
  if public.is_admin() then return new; end if;
  if tg_op = 'UPDATE' and old.published and old.store_id = new.store_id then return new; end if;
  if new.credit_used then return new; end if;
  if exists (select 1 from public.store_quota_uses where kind = 'spot' and ref_id = new.id) then return new; end if;

  v_src := private.use_plan_quota(new.store_id);
  if v_src is not null then
    insert into public.store_quota_uses(store_id, kind, ref_id, source) values (new.store_id, 'spot', new.id, v_src);
    return new;
  end if;
  if private.use_spot_credit(new.store_id) then
    new.credit_used := true;
    insert into public.store_quota_uses(store_id, kind, ref_id, source) values (new.store_id, 'spot', new.id, 'credit');
    return new;
  end if;
  if exists (select 1 from private.active_store_plan(new.store_id) ap where coalesce(ap.spot_monthly_limit, 1) > 0) then
    raise exception '今月のスポット求人・スカウトの回数を使い切りました。「スポット求人1件掲載」を追加すると公開できます。';
  end if;
  raise exception 'スポット求人の公開はスタンダードプラン以上、または「スポット求人1件掲載」の追加でご利用いただけます。';
end $$;

-- 公開中の求人の勤務日は今日〜2日後まで
create or replace function private.enforce_spot_shift_window()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  if public.is_admin() then return new; end if;
  if exists (select 1 from public.spot_jobs j where j.id = new.job_id and j.published)
     and (new.work_date < v_today or new.work_date > v_today + 2) then
    raise exception 'スポット求人の勤務日は、今日から2日後までの日を選んでください（公開する場合）。';
  end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'spot_job_shifts_window') then
    create trigger spot_job_shifts_window before insert or update on public.spot_job_shifts
      for each row execute function private.enforce_spot_shift_window();
  end if;
end $$;

-- 勤務の成立では数えない(回数は公開・オファーのときに使う)
create or replace function private.enforce_spot_monthly_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  return new;
end $$;

-- スカウト(お店からのオファー)は1人・1日ごとに1回
create or replace function private.consume_dealer_scout_credit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_src text;
begin
  if new.job_snapshot->>'source' <> 'store_offer' or new.job_snapshot->>'source' is null then return new; end if;
  if auth.uid() is null or not exists(select 1 from public.stores s where s.id=new.store_id and s.owner_user_id=auth.uid()) then
    raise exception '自店舗からのみスカウトできます。';
  end if;
  -- (このトリガーは AFTER INSERT。同じディーラー・同じ勤務日の重複オファーは on conflict で行が入らず、ここも動かない)
  v_src := private.use_plan_quota(new.store_id);
  if v_src is null then
    update public.store_scout_credits set balance=balance-1,updated_at=now()
     where store_id=new.store_id and balance>0;
    if not found then raise exception 'スカウトの回数がありません。「プラン・お支払い」からディーラースカウトをご購入ください。'; end if;
    v_src := 'credit';
  end if;
  insert into public.store_quota_uses(store_id, kind, ref_id, source) values (new.store_id, 'scout', new.id, v_src);
  return new;
end $$;
