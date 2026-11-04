-- レート別の成績(オーナー 2026/11/04)：VPIP などをリングのレート(SB/BB)ごとにも見られる。
-- レートの一覧は公開中のリングテーブルと、自分が打ったことのあるレートから自動で作る(テーブルを足せば自動で増える)。
create or replace function poker_private.hand_stats_summary(p_member uuid,p_kind text,p_bb integer) returns jsonb
language sql stable security definer set search_path='' as $$
 with rows as (
  select m.* from poker_private.hand_history_members m join poker_private.hand_histories h on h.hand_id=m.hand_id
  where m.member_id=p_member and (p_kind is null or h.kind=p_kind) and (p_bb is null or m.bb=p_bb)
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
revoke all on function poker_private.hand_stats_summary(uuid,text,integer) from public,anon,authenticated;

create or replace function public.poker_hand_stats(p_admin boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required'; end if;
 if not p_admin then
  return jsonb_build_object('asOf',now(),'ring',poker_private.hand_stats_summary(who,'ring'),'all',poker_private.hand_stats_summary(who,null),
   'stakes',coalesce((select jsonb_agg(jsonb_build_object('sb',s.sb,'bb',s.bb,'stats',poker_private.hand_stats_summary(who,'ring',s.bb)) order by s.bb,s.sb) from (
     select bb,min(sb) sb from (
      select t.sb,t.bb from public.poker_ring_tables t where t.published
      union all
      select coalesce(t.sb,(m.bb+1)/2),m.bb from poker_private.hand_history_members m join poker_private.hand_histories h on h.hand_id=m.hand_id and h.kind='ring'
       left join public.poker_ring_tables t on t.id=h.source_id where m.member_id=who and m.bb>0
     ) r where bb>0 group by bb) s),'[]'::jsonb));
 end if;
 if not coalesce(public.is_admin(),false) then raise exception 'Admin required'; end if;
 return jsonb_build_object('asOf',now(),'members',coalesce((select jsonb_agg(x order by (x->>'hands')::integer desc) from (
   select jsonb_build_object('memberId',m.member_id,'name',coalesce(nullif(u.raw_user_meta_data->>'display_name',''),'会員'))||poker_private.hand_stats_summary(m.member_id,'ring') x
   from (select distinct member_id from poker_private.hand_history_members) m left join auth.users u on u.id=m.member_id limit 500) q),'[]'::jsonb));
end;
$$;
revoke all on function public.poker_hand_stats(boolean) from public,anon;
grant execute on function public.poker_hand_stats(boolean) to authenticated;
