-- ATS (attempt to steal) in the ring player stats (owner 2026/10/30: VPIP PFR ATS 3BET CB).
-- Each saved hand now carries stealOpp/steal in hand_history_members.stats (lib/poker/hand-stats.ts);
-- hands saved before this count as no steal chance, so ATS starts from new hands.
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
   count(*) filter(where (stats->>'wonAtShowdown')::boolean) wsd,
   count(*) filter(where (stats->>'stealOpp')::boolean) steal_opp,
   count(*) filter(where (stats->>'steal')::boolean) steal
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

create or replace function poker_display.ring_member_hud(p_table uuid,p_seat integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=auth.uid();target uuid;s jsonb;n record;
begin
 if who is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or public.is_suspended() is distinct from false then raise exception 'Not authorized'; end if;
 if p_seat is null or p_seat not between 1 and 6 then raise exception 'Invalid seat'; end if;
 target:=poker_display.ring_seat_member(p_table,p_seat);
 if target is null then return null; end if;
 s:=poker_private.hand_stats_summary(target,'ring');
 select note,color into n from poker_private.member_notes where owner_id=who and target_id=target;
 return jsonb_build_object('seat',p_seat,'you',target=who,
  'stats',jsonb_build_object('hands',s->'hands','vpip',s->'vpip','pfr',s->'pfr','threeBet',s->'three_bet','threeBetOpp',s->'three_bet_opp',
   'cbet',s->'cbet','cbetOpp',s->'cbet_opp','foldTo3Bet',s->'fold_to_3bet','foldTo3BetOpp',s->'fold_to_3bet_opp',
   'foldToCbet',s->'fold_to_cbet','foldToCbetOpp',s->'fold_to_cbet_opp','sawFlop',s->'saw_flop','wtsd',s->'wtsd','wsd',s->'wsd','steal',s->'steal','stealOpp',s->'steal_opp'),
  'note',case when target=who then null else coalesce(n.note,'') end,'color',case when target=who then null else n.color end);
end; $$;
revoke all on function poker_display.ring_member_hud(uuid,integer) from public,anon;
grant execute on function poker_display.ring_member_hud(uuid,integer) to authenticated;
