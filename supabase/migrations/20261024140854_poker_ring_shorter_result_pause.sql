-- Runtime preserves all board reveal stages, then holds the winner for 6s.
-- Keep a 6s database minimum; seat ownership, readiness, replay and CAS guards are unchanged.
create or replace function poker_private.ring_play_begin(p_table uuid,p_hand uuid,p_roster jsonb,p_terms jsonb,p_sealed jsonb,p_result jsonb) returns bigint language plpgsql security definer set search_path='' as $$begin
 perform 1 from public.poker_ring_tables where id=p_table for update;
 if not exists(select 1 from poker_private.ring_hand_commits where hand_id=p_hand and request_id=p_hand) then
  if exists(select 1 from poker_private.ring_fund_reservations where table_id=p_table and status='seated' and (not play_enabled or present_until is null or present_until<=clock_timestamp() or exit_request is not null)) then raise exception 'Players not ready';end if;
  if exists(select 1 from poker_private.ring_hands where table_id=p_table and status='complete' and completed_at>clock_timestamp()-interval '6 seconds') then raise exception 'Presentation in progress';end if;
 end if;
 return poker_private.ring_hand_begin(p_table,p_hand,p_roster,p_terms,p_sealed,p_result);
end;$$;
