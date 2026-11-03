-- Tendency statistics (2026/10/26): per-player flags computed at save time (lib/poker/hand-stats.ts)
-- are kept next to each member's hand row, so totals stay cheap however many hands are played.
alter table poker_private.hand_history_members add column if not exists stats jsonb not null default '{}'::jsonb;
alter table poker_private.hand_history_members add column if not exists bb integer;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='hand_history_members_stats_object') then
  alter table poker_private.hand_history_members add constraint hand_history_members_stats_object check(jsonb_typeof(stats)='object' and length(stats::text)<=2000);
 end if;
end $$;

create or replace function public.poker_hand_history_save(p_hand uuid,p_kind text,p_source uuid,p_hand_number integer,p_record jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare inserted uuid;
begin
 if p_hand is null or p_source is null or p_kind is null or p_kind not in('ring','tournament')
    or p_record is null or jsonb_typeof(p_record)<>'object' or length(p_record::text)>200000
    or p_record->>'version' is distinct from '1' or p_record->>'handId' is distinct from p_hand::text
    or jsonb_typeof(p_record->'players') is distinct from 'array'
    or jsonb_array_length(p_record->'players') not between 2 and 6
    or jsonb_typeof(p_record->'actions') is distinct from 'array'
    or jsonb_typeof(p_record#>'{terms,bb}') is distinct from 'number'
    or exists(select 1 from jsonb_array_elements(p_record->'players') p
      where coalesce(p->>'seatId','') !~ '^seat-[1-6]$'
         or coalesce(p->>'memberId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         or jsonb_typeof(p->'net') is distinct from 'number'
         or jsonb_typeof(p->'hole') is distinct from 'array'
         or (p ? 'stats' and jsonb_typeof(p->'stats') is distinct from 'object'))
    or (select count(distinct p->>'memberId') from jsonb_array_elements(p_record->'players') p)<>jsonb_array_length(p_record->'players')
    or (select count(distinct p->>'seatId') from jsonb_array_elements(p_record->'players') p)<>jsonb_array_length(p_record->'players') then
   raise exception 'Invalid hand history';
 end if;
 insert into poker_private.hand_histories(hand_id,kind,source_id,hand_number,record)
   values(p_hand,p_kind,p_source,p_hand_number,p_record) on conflict(hand_id) do nothing returning hand_id into inserted;
 if inserted is null then return false; end if;
 insert into poker_private.hand_history_members(hand_id,member_id,seat_id,net,played_at,stats,bb)
   select p_hand,(p->>'memberId')::uuid,p->>'seatId',(p->>'net')::bigint,h.played_at,
     coalesce(p->'stats','{}'::jsonb)||jsonb_build_object('position',p->>'position'),(p_record#>>'{terms,bb}')::integer
   from jsonb_array_elements(p_record->'players') p cross join poker_private.hand_histories h where h.hand_id=p_hand;
 return true;
end;
$$;
revoke all on function public.poker_hand_history_save(uuid,text,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.poker_hand_history_save(uuid,text,uuid,integer,jsonb) to service_role;

-- Aggregate one member's rows. Counts are returned as numerator/denominator so the page can show sample size.
create or replace function poker_private.hand_stats_summary(p_member uuid,p_kind text) returns jsonb
language sql stable security definer set search_path='' as $$
 with rows as (
  select m.* from poker_private.hand_history_members m join poker_private.hand_histories h on h.hand_id=m.hand_id
  where m.member_id=p_member and (p_kind is null or h.kind=p_kind)
 ), f as (
  select count(*) hands,coalesce(sum(net),0) net,
   coalesce(sum(case when bb>0 then net::numeric/bb end),0) net_bb,
   count(*) filter(where (stats->>'vpip')::boolean) vpip,
   count(*) filter(where (stats->>'pfr')::boolean) pfr,
   count(*) filter(where (stats->>'threeBetOpp')::boolean) three_bet_opp,
   count(*) filter(where (stats->>'threeBet')::boolean) three_bet,
   count(*) filter(where (stats->>'foldTo3BetOpp')::boolean) fold_to_3bet_opp,
   count(*) filter(where (stats->>'foldTo3Bet')::boolean) fold_to_3bet,
   count(*) filter(where (stats->>'cbetOpp')::boolean) cbet_opp,
   count(*) filter(where (stats->>'cbet')::boolean) cbet,
   count(*) filter(where (stats->>'foldToCbetOpp')::boolean) fold_to_cbet_opp,
   count(*) filter(where (stats->>'foldToCbet')::boolean) fold_to_cbet,
   count(*) filter(where (stats->>'sawFlop')::boolean) saw_flop,
   count(*) filter(where (stats->>'wentToShowdown')::boolean) wtsd,
   count(*) filter(where (stats->>'wonAtShowdown')::boolean) wsd
  from rows
 )
 select to_jsonb(f)||jsonb_build_object(
  'bb100',case when f.hands>0 then round(f.net_bb*100/f.hands,2) else 0 end,
  'positions',coalesce((select jsonb_agg(jsonb_build_object('position',position,'hands',hands,'net',net,
     'bb100',case when hands>0 then round(net_bb*100/hands,2) else 0 end,'vpip',vpip,'pfr',pfr) order by array_position(array['UTG','HJ','CO','BTN','SB','BB'],position))
   from (select stats->>'position' position,count(*) hands,sum(net) net,sum(case when bb>0 then net::numeric/bb end) net_bb,
     count(*) filter(where (stats->>'vpip')::boolean) vpip,count(*) filter(where (stats->>'pfr')::boolean) pfr
     from rows where stats ? 'position' group by stats->>'position') q),'[]'::jsonb))
 from f;
$$;
revoke all on function poker_private.hand_stats_summary(uuid,text) from public,anon,authenticated;

-- Session-scoped read API. Members get their own totals; operators get every member's headline numbers.
create or replace function public.poker_hand_stats(p_admin boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required'; end if;
 if not p_admin then
  return jsonb_build_object('asOf',now(),'ring',poker_private.hand_stats_summary(who,'ring'),'all',poker_private.hand_stats_summary(who,null));
 end if;
 if not coalesce(public.is_admin(),false) then raise exception 'Admin required'; end if;
 return jsonb_build_object('asOf',now(),'members',coalesce((select jsonb_agg(x order by (x->>'hands')::integer desc) from (
   select jsonb_build_object('memberId',m.member_id,'name',coalesce(nullif(u.raw_user_meta_data->>'display_name',''),'会員'))||poker_private.hand_stats_summary(m.member_id,'ring') x
   from (select distinct member_id from poker_private.hand_history_members) m left join auth.users u on u.id=m.member_id limit 500) q),'[]'::jsonb));
end;
$$;
revoke all on function public.poker_hand_stats(boolean) from public,anon;
grant execute on function public.poker_hand_stats(boolean) to authenticated;
