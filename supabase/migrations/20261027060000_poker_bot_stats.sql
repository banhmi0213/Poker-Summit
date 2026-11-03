-- Staging CPU hands: running totals by position (and per CPU style) and by starting hand x position
-- (owner request 2026/10/27). Totals keep growing even though only the newest hands are stored.
create table if not exists poker_private.bot_position_stats(
 position text not null, style text not null,
 hands bigint not null default 0, vpip bigint not null default 0, pfr bigint not null default 0,
 three_bet_opp bigint not null default 0, three_bet bigint not null default 0,
 fold_to_3bet_opp bigint not null default 0, fold_to_3bet bigint not null default 0,
 cbet_opp bigint not null default 0, cbet bigint not null default 0,
 fold_to_cbet_opp bigint not null default 0, fold_to_cbet bigint not null default 0,
 saw_flop bigint not null default 0, wtsd bigint not null default 0, wsd bigint not null default 0,
 net_bb numeric not null default 0,
 primary key(position,style));
create table if not exists poker_private.bot_class_stats(
 position text not null, class text not null,
 hands bigint not null default 0, vpip bigint not null default 0, pfr bigint not null default 0, won bigint not null default 0,
 net_bb numeric not null default 0,
 primary key(position,class));
alter table poker_private.bot_position_stats enable row level security;
alter table poker_private.bot_class_stats enable row level security;

-- Seat styles are fixed by seat (lib/poker/bot-hands.ts STYLE_ORDER).
create or replace function poker_private.bot_style(seat text) returns text language sql immutable set search_path='' as $$
 select case seat when 'seat-1' then '標準' when 'seat-2' then '堅実' when 'seat-3' then '参加多め' when 'seat-4' then '攻撃的' when 'seat-5' then '標準' when 'seat-6' then '攻撃的' else '?' end;
$$;
-- Starting hand class such as AKs, QJo, 77.
create or replace function poker_private.bot_hand_class(hole jsonb) returns text language sql immutable set search_path='' as $$
 with c as (select (hole->0->>'rank')::int r1,(hole->1->>'rank')::int r2,hole->0->>'suit' s1,hole->1->>'suit' s2),
 o as (select greatest(r1,r2) hi,least(r1,r2) lo,s1=s2 suited from c)
 select substr('23456789TJQKA',hi-1,1)||substr('23456789TJQKA',lo-1,1)||case when hi=lo then '' when suited then 's' else 'o' end from o;
$$;

create or replace function poker_private.bot_add_stats(p_hands jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 with p as (select x,(h->'terms'->>'bb')::numeric bb from jsonb_array_elements(p_hands) h,jsonb_array_elements(h->'players') x),
 g as (select x->>'position' position,poker_private.bot_style(x->>'seatId') style,count(*) hands,
   count(*) filter(where (x->'stats'->>'vpip')::boolean) vpip,count(*) filter(where (x->'stats'->>'pfr')::boolean) pfr,
   count(*) filter(where (x->'stats'->>'threeBetOpp')::boolean) tbo,count(*) filter(where (x->'stats'->>'threeBet')::boolean) tb,
   count(*) filter(where (x->'stats'->>'foldTo3BetOpp')::boolean) ftbo,count(*) filter(where (x->'stats'->>'foldTo3Bet')::boolean) ftb,
   count(*) filter(where (x->'stats'->>'cbetOpp')::boolean) cbo,count(*) filter(where (x->'stats'->>'cbet')::boolean) cb,
   count(*) filter(where (x->'stats'->>'foldToCbetOpp')::boolean) fcbo,count(*) filter(where (x->'stats'->>'foldToCbet')::boolean) fcb,
   count(*) filter(where (x->'stats'->>'sawFlop')::boolean) sf,count(*) filter(where (x->'stats'->>'wentToShowdown')::boolean) sd,
   count(*) filter(where (x->'stats'->>'wonAtShowdown')::boolean) wsd,coalesce(sum((x->>'net')::numeric/nullif(bb,0)),0) net
  from p group by 1,2)
 insert into poker_private.bot_position_stats as t(position,style,hands,vpip,pfr,three_bet_opp,three_bet,fold_to_3bet_opp,fold_to_3bet,cbet_opp,cbet,fold_to_cbet_opp,fold_to_cbet,saw_flop,wtsd,wsd,net_bb)
 select * from g
 on conflict(position,style) do update set hands=t.hands+excluded.hands,vpip=t.vpip+excluded.vpip,pfr=t.pfr+excluded.pfr,
  three_bet_opp=t.three_bet_opp+excluded.three_bet_opp,three_bet=t.three_bet+excluded.three_bet,fold_to_3bet_opp=t.fold_to_3bet_opp+excluded.fold_to_3bet_opp,
  fold_to_3bet=t.fold_to_3bet+excluded.fold_to_3bet,cbet_opp=t.cbet_opp+excluded.cbet_opp,cbet=t.cbet+excluded.cbet,
  fold_to_cbet_opp=t.fold_to_cbet_opp+excluded.fold_to_cbet_opp,fold_to_cbet=t.fold_to_cbet+excluded.fold_to_cbet,
  saw_flop=t.saw_flop+excluded.saw_flop,wtsd=t.wtsd+excluded.wtsd,wsd=t.wsd+excluded.wsd,net_bb=t.net_bb+excluded.net_bb;
 with p as (select x,(h->'terms'->>'bb')::numeric bb from jsonb_array_elements(p_hands) h,jsonb_array_elements(h->'players') x),
 g as (select x->>'position' position,poker_private.bot_hand_class(x->'hole') class,count(*) hands,
   count(*) filter(where (x->'stats'->>'vpip')::boolean) vpip,count(*) filter(where (x->'stats'->>'pfr')::boolean) pfr,
   count(*) filter(where (x->>'net')::numeric>0) won,coalesce(sum((x->>'net')::numeric/nullif(bb,0)),0) net
  from p where jsonb_array_length(x->'hole')=2 group by 1,2)
 insert into poker_private.bot_class_stats as t(position,class,hands,vpip,pfr,won,net_bb) select * from g
 on conflict(position,class) do update set hands=t.hands+excluded.hands,vpip=t.vpip+excluded.vpip,pfr=t.pfr+excluded.pfr,won=t.won+excluded.won,net_bb=t.net_bb+excluded.net_bb;
end;$$;
revoke all on function poker_private.bot_add_stats(jsonb) from public,anon,authenticated;

create or replace function public.poker_bot_record(p_batch jsonb) returns void language plpgsql security definer set search_path='' as $$
declare keep int;n int;a int;
begin
 if jsonb_typeof(p_batch->'hands')<>'array' or jsonb_typeof(p_batch->'anomalies')<>'array' or jsonb_array_length(p_batch->'hands')>500 or jsonb_array_length(p_batch->'anomalies')>500 then raise exception 'Invalid bot batch';end if;
 insert into poker_private.bot_hands(table_no,history,actions,ms)
  select (h->>'table')::int,h->'history',(h->>'actions')::int,round((h->>'ms')::numeric)::int from jsonb_array_elements(p_batch->'hands') h;
 insert into poker_private.bot_anomalies(table_no,kind,detail,checkpoint)
  select (x->>'table')::int,left(x->>'kind',80),left(coalesce(x->>'detail',''),2000),x->'checkpoint' from jsonb_array_elements(p_batch->'anomalies') x;
 perform poker_private.bot_add_stats((select coalesce(jsonb_agg(h->'history'),'[]'::jsonb) from jsonb_array_elements(p_batch->'hands') h));
 n:=jsonb_array_length(p_batch->'hands');a:=jsonb_array_length(p_batch->'anomalies');
 insert into poker_private.bot_batches(hands,anomalies,avg_ms,max_ms,rss_mb)
  values(n,a,coalesce((p_batch->'stats'->>'avg_ms')::real,0),coalesce((p_batch->'stats'->>'max_ms')::real,0),coalesce((p_batch->'stats'->>'rss_mb')::int,0));
 -- Keep only the newest hands so the staging database does not fill up (the totals above keep everything).
 select keep_hands into keep from poker_private.bot_settings where id=1;
 delete from poker_private.bot_hands where id<=(select max(id) from poker_private.bot_hands)-coalesce(keep,30000);
 delete from poker_private.bot_batches where created_at<now()-interval '30 days';
end;$$;
revoke all on function public.poker_bot_record(jsonb) from public,anon,authenticated;
grant execute on function public.poker_bot_record(jsonb) to service_role;

-- Admin view of the totals.
create or replace function public.poker_bot_stats() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Admin required'; end if;
 return jsonb_build_object(
  'asOf',now(),
  'settings',(select to_jsonb(s)-'id' from poker_private.bot_settings s where id=1),
  'stored',(select count(*) from poker_private.bot_hands),
  'positions',coalesce((select jsonb_agg(to_jsonb(p)) from poker_private.bot_position_stats p),'[]'::jsonb),
  'classes',coalesce((select jsonb_agg(to_jsonb(c)) from poker_private.bot_class_stats c),'[]'::jsonb),
  'speed',(select jsonb_build_object('hands',coalesce(sum(hands),0),'avgMs',round(avg(avg_ms)::numeric,1),'maxMs',round(max(max_ms)::numeric,1),'rssMb',max(rss_mb)) from poker_private.bot_batches where created_at>now()-interval '1 hour'),
  'anomalies',(select count(*) from poker_private.bot_anomalies),
  'recentAnomalies',coalesce((select jsonb_agg(jsonb_build_object('at',created_at,'kind',kind,'detail',left(detail,300)) order by id desc) from (select * from poker_private.bot_anomalies order by id desc limit 20) a),'[]'::jsonb));
end;$$;
revoke all on function public.poker_bot_stats() from public,anon;
grant execute on function public.poker_bot_stats() to authenticated;

-- Count the hands already stored before the totals existed (only when the totals are still empty).
do $$begin
 if not exists(select 1 from poker_private.bot_position_stats) then
  perform poker_private.bot_add_stats(coalesce((select jsonb_agg(history) from poker_private.bot_hands),'[]'::jsonb));
 end if;
end$$;
