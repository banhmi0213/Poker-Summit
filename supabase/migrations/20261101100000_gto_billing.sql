-- GTO有料プラン(オーナー＋GTOチャット決定 2026/11/01)。ライト／フル、月額・年額、3日間の無料お試し。決済は KOMOJU のカード定期課金。
-- 会員の画面からは自分のプランの状態を読むだけ(public.gto_plan_status)。書き込みはサーバー(service_role)だけが行う。
-- 店舗クーポンなどの「ライト1か月無料」は plan_grants に入れる。状態は、契約と付与のうち一番良いものを返す。

create table if not exists public.gto_member_plans(
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references auth.users(id) on delete cascade,
 tier text not null check(tier in ('light','full')),
 period text not null check(period in ('month','year')),
 -- pending: カード登録画面に送った直後 / trialing: お試し中 / active: 課金中 / past_due: 決済失敗で再試行中 / canceled: 解約・停止
 status text not null default 'pending' check(status in ('pending','trialing','active','past_due','canceled')),
 komoju_session_id text,
 komoju_customer_id text,
 komoju_subscription_id text,
 trial_ends_at timestamptz,
 current_period_end timestamptz,
 cancel_at_period_end boolean not null default false,
 canceled_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists gto_member_plans_member on public.gto_member_plans(member_id,created_at desc);
create unique index if not exists gto_member_plans_session on public.gto_member_plans(komoju_session_id) where komoju_session_id is not null;
create unique index if not exists gto_member_plans_subscription on public.gto_member_plans(komoju_subscription_id) where komoju_subscription_id is not null;
-- 1人が同時に持てる「生きている」契約は1つだけ(解約済みは何件でも残る)。
create unique index if not exists gto_member_plans_one_open on public.gto_member_plans(member_id) where status in ('pending','trialing','active','past_due');

create table if not exists public.gto_plan_grants(
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references auth.users(id) on delete cascade,
 tier text not null check(tier in ('light','full')),
 starts_at timestamptz not null default now(),
 ends_at timestamptz not null,
 source text not null check(length(source) between 1 and 40),
 ref text check(ref is null or length(ref) between 1 and 200),
 created_at timestamptz not null default now(),
 check(ends_at>starts_at)
);
create index if not exists gto_plan_grants_member on public.gto_plan_grants(member_id,ends_at desc);
-- 同じクーポン(出どころ＋番号)は1人1回だけ。
create unique index if not exists gto_plan_grants_once on public.gto_plan_grants(member_id,source,ref) where ref is not null;

-- KOMOJU の Webhook は同じ通知を何度も送ることがある。X-Komoju-ID で1回だけ処理する。
create table if not exists public.gto_billing_events(
 id text primary key check(length(id) between 1 and 200),
 event text not null check(length(event) between 1 and 100),
 received_at timestamptz not null default now(),
 processed_at timestamptz,
 note text check(note is null or length(note)<=500)
);

alter table public.gto_member_plans enable row level security;
alter table public.gto_plan_grants enable row level security;
alter table public.gto_billing_events enable row level security;
revoke all on public.gto_member_plans,public.gto_plan_grants,public.gto_billing_events from public,anon,authenticated;
grant select,insert,update on public.gto_member_plans,public.gto_plan_grants,public.gto_billing_events to service_role;

-- 会員1人のプランの状態(サーバー用)。tier: free|light|full、expiresAt: 今の権利が切れる日時、trial: お試し中か。
create or replace function public.gto_plan_status_for(p_member uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare best text:='free'; best_end timestamptz; is_trial boolean:=false; r record; open_plan public.gto_member_plans%rowtype;
begin
 if p_member is null then return jsonb_build_object('tier','free','active',false,'expiresAt',null,'trial',false,'plan',null);end if;
 for r in
  select p.tier,case when p.status='trialing' then p.trial_ends_at else p.current_period_end end as ends,p.status='trialing' as trial
   from public.gto_member_plans p
   where p.member_id=p_member and (
    (p.status='trialing' and p.trial_ends_at>now())
    or (p.status in ('active','past_due') and p.current_period_end>now())
    or (p.status='canceled' and p.cancel_at_period_end and p.current_period_end>now()))
  union all
  select g.tier,g.ends_at,false from public.gto_plan_grants g where g.member_id=p_member and g.starts_at<=now() and g.ends_at>now()
 loop
  if (r.tier='full' and best<>'full') or (r.tier=best and (best_end is null or r.ends>best_end)) or (r.tier='light' and best='free') then
   best:=r.tier;best_end:=r.ends;is_trial:=r.trial;
  end if;
 end loop;
 select * into open_plan from public.gto_member_plans where member_id=p_member order by created_at desc limit 1;
 return jsonb_build_object('tier',best,'active',best<>'free','expiresAt',best_end,'trial',is_trial,
  'plan',case when open_plan.id is null then null else jsonb_build_object('tier',open_plan.tier,'period',open_plan.period,'status',open_plan.status,
   'trialEndsAt',open_plan.trial_ends_at,'currentPeriodEnd',open_plan.current_period_end,'cancelAtPeriodEnd',open_plan.cancel_at_period_end) end);
end;$$;
revoke all on function public.gto_plan_status_for(uuid) from public,anon,authenticated;
grant execute on function public.gto_plan_status_for(uuid) to service_role;

-- 自分のプランの状態(ログイン中の会員用)。
create or replace function public.gto_plan_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then return jsonb_build_object('tier','free','active',false,'expiresAt',null,'trial',false,'plan',null);end if;
 return public.gto_plan_status_for(auth.uid());
end;$$;
revoke all on function public.gto_plan_status() from public;
grant execute on function public.gto_plan_status() to anon,authenticated;

-- 期間付きの付与(例：店舗クーポンの「ライト1か月無料」)。同じ出どころ＋番号は1回だけ(2回目は既存の行を返す)。サーバー用。
create or replace function public.gto_plan_grant(p_member uuid,p_tier text,p_days integer,p_source text,p_ref text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare gid uuid;
begin
 if p_member is null or p_tier not in ('light','full') or p_days is null or p_days<1 or p_days>366 or p_source is null or length(p_source) not between 1 and 40 then raise exception 'Invalid plan grant';end if;
 if p_ref is not null then
  select id into gid from public.gto_plan_grants where member_id=p_member and source=p_source and ref=p_ref;
  if found then return gid;end if;
 end if;
 insert into public.gto_plan_grants(member_id,tier,ends_at,source,ref) values(p_member,p_tier,now()+make_interval(days=>p_days),p_source,p_ref) returning id into gid;
 return gid;
end;$$;
revoke all on function public.gto_plan_grant(uuid,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.gto_plan_grant(uuid,text,integer,text,text) to service_role;
