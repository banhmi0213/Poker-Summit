-- GTOプランの確定内容(GTOチャット 2026/11/01)。
-- 1) プラン名を「スタンダード」「プロ」に(ライト=standard、フル=pro)。古い名前の入力も受け付けて読み替える。クーポンの付与はスタンダード。
-- 2) プロはスタート記念価格(〜2027年2月末)から2027年3月1日に新料金へ。KOMOJU の定期課金は金額が固定なので、
--    次の請求が3月1日以降になる時に、古い定期課金を止めて新しい金額で作り直す(lib/billing/service.ts switchPrices)。
--    その途中経過(price_switch_state)と記録(gto_price_switches)を持つ。今の定期課金の金額(komoju_amount)も持つ。
-- 3) プロの申込みでは「値上げの日と新しい料金を確認しました」の確認が必須。確認した版と日時と表示した金額をプランの行に残す。
-- 4) 2027年2月1日・2月22日のお知らせメールは、会員ごとに1回だけ(gto_plan_notices)。

alter table public.gto_member_plans drop constraint if exists gto_member_plans_tier_check;
alter table public.gto_plan_grants drop constraint if exists gto_plan_grants_tier_check;
update public.gto_member_plans set tier=case tier when 'light' then 'standard' when 'full' then 'pro' else tier end where tier in ('light','full');
update public.gto_plan_grants set tier=case tier when 'light' then 'standard' when 'full' then 'pro' else tier end where tier in ('light','full');
alter table public.gto_member_plans add constraint gto_member_plans_tier_check check(tier in ('standard','pro'));
alter table public.gto_plan_grants add constraint gto_plan_grants_tier_check check(tier in ('standard','pro'));

alter table public.gto_member_plans add column if not exists komoju_amount integer check(komoju_amount is null or komoju_amount between 1 and 1000000);
alter table public.gto_member_plans add column if not exists price_switch_state text check(price_switch_state is null or price_switch_state in ('deleting','creating','failed'));
alter table public.gto_member_plans add column if not exists price_ack_version text check(price_ack_version is null or length(price_ack_version) between 1 and 40);
alter table public.gto_member_plans add column if not exists price_ack_at timestamptz;
alter table public.gto_member_plans add column if not exists price_ack_shown jsonb;
-- プロの申込みは確認なしでは作れない(サーバーでも確認しているが、データベースでも守る)。
alter table public.gto_member_plans drop constraint if exists gto_member_plans_pro_ack;
alter table public.gto_member_plans add constraint gto_member_plans_pro_ack check(tier<>'pro' or status<>'pending' or (price_ack_version is not null and price_ack_at is not null)) not valid;

create table if not exists public.gto_price_switches(
 id uuid primary key default gen_random_uuid(),
 plan_id uuid not null references public.gto_member_plans(id) on delete cascade,
 member_id uuid not null references auth.users(id) on delete cascade,
 old_subscription text,
 new_subscription text,
 old_amount integer,
 new_amount integer not null,
 outcome text not null check(outcome in ('ok','declined','check_by_hand')),
 created_at timestamptz not null default now()
);
create index if not exists gto_price_switches_plan on public.gto_price_switches(plan_id,created_at desc);

create table if not exists public.gto_plan_notices(
 member_id uuid not null references auth.users(id) on delete cascade,
 notice_key text not null check(length(notice_key) between 1 and 60),
 sent_at timestamptz not null default now(),
 primary key(member_id,notice_key)
);

alter table public.gto_price_switches enable row level security;
alter table public.gto_plan_notices enable row level security;
revoke all on public.gto_price_switches,public.gto_plan_notices from public,anon,authenticated;
grant select,insert,update,delete on public.gto_price_switches,public.gto_plan_notices to service_role;
grant delete on public.gto_plan_notices to service_role;

-- 会員1人のプランの状態(サーバー用)。tier: free|standard|pro。
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
  if (r.tier='pro' and best<>'pro') or (r.tier=best and (best_end is null or r.ends>best_end)) or (r.tier='standard' and best='free') then
   best:=r.tier;best_end:=r.ends;is_trial:=r.trial;
  end if;
 end loop;
 select * into open_plan from public.gto_member_plans where member_id=p_member order by created_at desc limit 1;
 return jsonb_build_object('tier',best,'active',best<>'free','expiresAt',best_end,'trial',is_trial,
  'plan',case when open_plan.id is null then null else jsonb_build_object('tier',open_plan.tier,'period',open_plan.period,'status',open_plan.status,
   'trialEndsAt',open_plan.trial_ends_at,'currentPeriodEnd',open_plan.current_period_end,'cancelAtPeriodEnd',open_plan.cancel_at_period_end,'amount',open_plan.komoju_amount) end);
end;$$;
revoke all on function public.gto_plan_status_for(uuid) from public,anon,authenticated;
grant execute on function public.gto_plan_status_for(uuid) to service_role;

-- 期間付きの付与(例：店舗クーポンの「1か月無料」＝スタンダード)。古い名前(light/full)も読み替える。サーバー用。
create or replace function public.gto_plan_grant(p_member uuid,p_tier text,p_days integer,p_source text,p_ref text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare gid uuid; t text:=case p_tier when 'light' then 'standard' when 'full' then 'pro' else p_tier end;
begin
 if p_member is null or t is null or t not in ('standard','pro') or p_days is null or p_days<1 or p_days>366 or p_source is null or length(p_source) not between 1 and 40 then raise exception 'Invalid plan grant';end if;
 if p_ref is not null then
  select id into gid from public.gto_plan_grants where member_id=p_member and source=p_source and ref=p_ref;
  if found then return gid;end if;
 end if;
 insert into public.gto_plan_grants(member_id,tier,ends_at,source,ref) values(p_member,t,now()+make_interval(days=>p_days),p_source,p_ref) returning id into gid;
 return gid;
end;$$;
revoke all on function public.gto_plan_grant(uuid,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.gto_plan_grant(uuid,text,integer,text,text) to service_role;
