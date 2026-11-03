-- チップは毎月1日0時(日本時間)に1,000へリセット(オーナー 2026/10/31：どんだけ増えようが減ろうが月1リセット)。
-- 月ごとの増減(リングのハンドの精算の合計)と、その月の終わりの残高は会員ごとに残り、プレイヤーページで見られる。
-- リセットは月が替わってから最初にチップを使う(残高を見る・着席する・交換する)ときに行う。卓に座ったまま月をまたいだ人は、
-- 卓から立ってチップが戻ってからリセットされる(卓のチップは取り上げない)。
alter table poker_private.ring_accounts add column if not exists season text not null default to_char(now() at time zone 'Asia/Tokyo','YYYY-MM') check(season ~ '^\d{4}-\d{2}$');
alter table poker_private.ring_chip_ledger drop constraint if exists ring_chip_ledger_kind_check;
alter table poker_private.ring_chip_ledger add constraint ring_chip_ledger_kind_check check(kind in('welcome','reserve','refund','settlement','cashout','refill','reset'));
alter table poker_private.ring_chip_ledger drop constraint if exists ring_chip_ledger_check;
alter table poker_private.ring_chip_ledger add constraint ring_chip_ledger_check check(
 (kind='welcome' and available_delta in (1000,3000) and in_play_delta=0 and reservation_id is null and hand_id is null) or
 (kind='reserve' and available_delta<0 and in_play_delta=-available_delta and reservation_id is not null and hand_id is null) or
 (kind='refund' and available_delta>0 and in_play_delta=-available_delta and reservation_id is not null and hand_id is null) or
 (kind='cashout' and available_delta>=0 and in_play_delta=-available_delta and reservation_id is not null and hand_id is null) or
 (kind='settlement' and available_delta=0 and reservation_id is not null and hand_id is not null) or
 (kind='refill' and available_delta>0 and available_delta<=3000 and in_play_delta=0 and reservation_id is null and hand_id is null) or
 (kind='reset' and in_play_delta=0 and reservation_id is null and hand_id is null));

create table if not exists poker_private.ring_seasons(
 member_id uuid not null references auth.users(id) on delete cascade,
 season text not null check(season ~ '^\d{4}-\d{2}$'),
 end_balance bigint not null check(end_balance>=0),
 closed_at timestamptz not null default now(),
 primary key(member_id,season)
);
alter table poker_private.ring_seasons enable row level security;
revoke all on poker_private.ring_seasons from public,anon,authenticated;

create or replace function poker_private.ensure_ring_season(p_member uuid) returns void language plpgsql security definer set search_path='' as $$
declare a poker_private.ring_accounts%rowtype; cur text:=to_char(now() at time zone 'Asia/Tokyo','YYYY-MM');
begin
 select * into a from poker_private.ring_accounts where member_id=p_member for update;
 if not found or a.season>=cur or a.in_play>0 then return;end if;
 insert into poker_private.ring_seasons(member_id,season,end_balance) values(p_member,a.season,a.available) on conflict do nothing;
 update poker_private.ring_accounts set available=1000,season=cur,updated_at=now() where member_id=p_member;
 if a.available<>1000 then
  insert into poker_private.ring_chip_ledger(member_id,request_id,kind,available_delta,in_play_delta) values(p_member,gen_random_uuid(),'reset',1000-a.available,0);
 end if;
end;$$;
revoke all on function poker_private.ensure_ring_season(uuid) from public,anon,authenticated,service_role;

create or replace function poker_private.ensure_ring_welcome(p_member uuid) returns void language plpgsql security definer set search_path='' as $$
declare email_address text; identity bytea; accepted uuid;
begin
 select lower(btrim(u.email)) into email_address from auth.users u where u.id=p_member and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and u.deleted_at is null and (u.banned_until is null or u.banned_until<now()) and u.email is not null and u.email not ilike '%@login.poker-summit.jp' and not exists(select 1 from public.member_status s where s.user_id=u.id and s.suspended) for key share;
 if email_address is null then return;end if;
 insert into poker_private.ring_accounts(member_id) values(p_member) on conflict do nothing;
 perform 1 from poker_private.ring_accounts where member_id=p_member for update;
 perform poker_private.ensure_ring_season(p_member);
 if exists(select 1 from poker_private.ring_welcome_claims where member_id=p_member) then return;end if;
 select extensions.hmac(convert_to(email_address,'UTF8'),secret,'sha256') into identity from poker_private.ring_identity_secret where id;
 insert into poker_private.ring_welcome_claims(identity_key,member_id,amount) values(identity,p_member,1000) on conflict do nothing returning member_id into accepted;
 if accepted is null then return;end if;
 update poker_private.ring_accounts set available=available+1000,updated_at=now() where member_id=p_member;
 insert into poker_private.ring_chip_ledger(member_id,request_id,kind,available_delta,in_play_delta) values(p_member,gen_random_uuid(),'welcome',1000,0);
end;$$;

-- 自分の月ごとの増減(直近12か月、日本時間の月)。増減＝リングのハンドの精算の合計(レーキ込み)。
create or replace function public.poker_ring_monthly() returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required';end if;
 perform poker_private.ensure_ring_welcome(who);
 return coalesce((select jsonb_agg(jsonb_build_object('month',m.month,'net',m.net,'hands',m.hands,'endBalance',s.end_balance) order by m.month desc) from (
   select to_char(l.created_at at time zone 'Asia/Tokyo','YYYY-MM') as month,sum(l.in_play_delta)::bigint net,count(*)::integer hands
   from poker_private.ring_chip_ledger l where l.member_id=who and l.kind='settlement' and l.created_at>=now()-interval '13 months' group by 1) m
  left join poker_private.ring_seasons s on s.member_id=who and s.season=m.month),'[]'::jsonb);
end;$$;
revoke all on function public.poker_ring_monthly() from public,anon;
grant execute on function public.poker_ring_monthly() to authenticated;

-- 順位はその月の残高で比べる。まだリセットされていない(先月から使っていない)会員は1,000として数える。
create or replace function poker_private.ring_balance() returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); result jsonb;
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required';end if;
 perform poker_private.ensure_ring_welcome(who);
 select jsonb_build_object('available',a.available,'inPlay',a.in_play,'total',a.available+a.in_play,
 'rank',1+(select count(*) from poker_private.ring_accounts other join auth.users u on u.id=other.member_id where (case when other.season<to_char(now() at time zone 'Asia/Tokyo','YYYY-MM') and other.in_play=0 then 1000 else other.available+other.in_play end)>a.available+a.in_play and not coalesce(u.is_anonymous,false) and u.email_confirmed_at is not null and u.deleted_at is null),
 'welcomeGranted',exists(select 1 from poker_private.ring_welcome_claims where member_id=who),'asOf',now(),
 'history',coalesce((select jsonb_agg(to_jsonb(h)) from(select kind,available_delta as "availableDelta",in_play_delta as "inPlayDelta",created_at as "createdAt" from poker_private.ring_chip_ledger where member_id=who order by created_at desc,id desc limit 20) h),'[]'::jsonb)) into result from poker_private.ring_accounts a where member_id=who;
 return coalesce(result,jsonb_build_object('available',0,'inPlay',0,'total',0,'rank',null,'welcomeGranted',false,'asOf',now(),'history','[]'::jsonb));
end;$$;

create or replace function poker_private.poker_statistics(p_admin boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); payload jsonb;
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required'; end if;
 if p_admin and not coalesce(public.is_admin(),false) then raise exception 'Admin required'; end if;
 with finishes as (
 select f.tournament_id,t.title,f.finished_at,x as row
 from poker_private.tournament_finishes f join public.poker_tournaments t on t.id=f.tournament_id cross join lateral jsonb_array_elements(f.standings) x
 ), totals as (
 select row->>'memberId' member_id,max(row->>'name') name,count(*) played,
 count(*) filter(where (row->>'place')::integer=1) firsts,
 count(*) filter(where (row->>'place')::integer=2) seconds,
 count(*) filter(where (row->>'place')::integer=3) thirds from finishes group by row->>'memberId'
 ), rings as (
 select member_id,case when (case when ra.season<to_char(now() at time zone 'Asia/Tokyo','YYYY-MM') and ra.in_play=0 then 1000 else ra.available+ra.in_play end)<>ra.available+ra.in_play then 1000 else ra.available end available,ra.in_play,(case when ra.season<to_char(now() at time zone 'Asia/Tokyo','YYYY-MM') and ra.in_play=0 then 1000 else ra.available+ra.in_play end) total,updated_at,rank() over(order by (case when ra.season<to_char(now() at time zone 'Asia/Tokyo','YYYY-MM') and ra.in_play=0 then 1000 else ra.available+ra.in_play end) desc) position from poker_private.ring_accounts ra
 )
 select jsonb_build_object('asOf',now(),
 'players',coalesce((select jsonb_agg(to_jsonb(q)) from (select * from totals where p_admin or member_id=who::text order by firsts desc,seconds desc,thirds desc,member_id limit 500) q),'[]'::jsonb),
 'history',coalesce((select jsonb_agg(to_jsonb(q)) from (select tournament_id,title,finished_at,row from finishes where p_admin or row->>'memberId'=who::text order by finished_at desc,tournament_id limit 500) q),'[]'::jsonb),
 'ring',coalesce((select jsonb_agg(to_jsonb(q)) from (select r.*,coalesce(nullif(u.raw_user_meta_data->>'display_name',''),'会員') name from rings r join auth.users u on u.id=r.member_id where p_admin or r.member_id=who order by position,r.member_id limit 500) q),'[]'::jsonb),
 'upcoming',coalesce((select jsonb_agg(to_jsonb(q)) from (select t.id,t.title,t.starts_at,a.room_id from poker_private.tournament_registrations reg join public.poker_tournaments t on t.id=reg.tournament_id left join poker_private.room_admissions a on a.tournament_id=t.id and a.member_id=reg.member_id where t.deleted_at is null and reg.member_id=who and not exists(select 1 from poker_private.tournament_finishes f where f.tournament_id=t.id) order by t.starts_at limit 100) q),'[]'::jsonb)) into payload;
 return payload;
end;
$$;
