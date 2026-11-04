-- 対戦中にアイコンを押して見る数字(オーナー 2026/11/04)：その卓のレートで打ったハンドだけで出す。テーブルを足しても自動で反映。
create or replace function poker_display.ring_member_hud(p_table uuid,p_seat integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=auth.uid();target uuid;s jsonb;n record;stake integer;
begin
 if who is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or public.is_suspended() is distinct from false then raise exception 'Not authorized'; end if;
 if p_seat is null or p_seat not between 1 and 6 then raise exception 'Invalid seat'; end if;
 target:=poker_display.ring_seat_member(p_table,p_seat);
 if target is null then return null; end if;
 select t.bb into stake from public.poker_ring_tables t where t.id=p_table;
 s:=poker_private.hand_stats_summary(target,'ring',stake);
 select note,color into n from poker_private.member_notes where owner_id=who and target_id=target;
 return jsonb_build_object('seat',p_seat,'you',target=who,
  'stats',jsonb_build_object('hands',s->'hands','vpip',s->'vpip','pfr',s->'pfr','threeBet',s->'three_bet','threeBetOpp',s->'three_bet_opp',
   'cbet',s->'cbet','cbetOpp',s->'cbet_opp','foldTo3Bet',s->'fold_to_3bet','foldTo3BetOpp',s->'fold_to_3bet_opp',
   'foldToCbet',s->'fold_to_cbet','foldToCbetOpp',s->'fold_to_cbet_opp','sawFlop',s->'saw_flop','wtsd',s->'wtsd','wsd',s->'wsd','steal',s->'steal','stealOpp',s->'steal_opp'),
  'note',case when target=who then null else coalesce(n.note,'') end,'color',case when target=who then null else n.color end);
end; $$;
revoke all on function poker_display.ring_member_hud(uuid,integer) from public,anon;
grant execute on function poker_display.ring_member_hud(uuid,integer) to authenticated;
