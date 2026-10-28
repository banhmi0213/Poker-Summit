-- Ring think time is 10s; the free time bank still adds 20s, the ticket bank 30s (owner 2026/10/28: 最初の持ち時間は10秒、延長20秒).
-- Same functions as before with only the base turn length changed (20s -> 10s); the free bank is accepted up to the extended 30s deadline.
-- The base turn length lives in one function so every deadline check agrees (and slow browser fixtures can lengthen it).
create or replace function poker_private.ring_turn_interval() returns interval language sql stable set search_path='' as $$select interval '10 seconds'$$;
revoke all on function poker_private.ring_turn_interval() from public,anon,authenticated;
grant execute on function poker_private.ring_turn_interval() to service_role;

create or replace function poker_private.ring_play_write_v2(p_hand uuid,p_expected bigint,p_write uuid,p_sealed jsonb,p_result jsonb,p_timeout boolean,p_from integer,p_actor uuid) returns bigint language plpgsql security definer set search_path='' as $$
declare tid uuid;changed timestamptz;v bigint;extra interval;actor poker_private.ring_fund_reservations%rowtype;
begin
 select table_id into tid from poker_private.ring_hands where id=p_hand;
 perform 1 from public.poker_ring_tables where id=tid for update;
 if not exists(select 1 from poker_private.ring_hand_commits where hand_id=p_hand and request_id=p_write) then
  select * into actor from poker_private.ring_fund_reservations where id=p_actor and table_id=tid and status='seated' for update;
  if not found or not exists(select 1 from poker_private.ring_hands h,jsonb_array_elements(h.participants) p where h.id=p_hand and (p->>'reservationId')::uuid=p_actor) then raise exception 'Actor unavailable';end if;
  if not p_timeout and actor.sit_out_since is not null then raise exception 'Player sitting out';end if;
  -- Free bank +20s and ticket bank +30s for the turn being written.
  select (case when bank_revision=p_expected then interval '20 seconds' else interval '0 seconds' end)+(case when ticket_revision=p_expected then interval '30 seconds' else interval '0 seconds' end) into extra from poker_private.ring_hands where id=p_hand;
  select created_at into changed from poker_private.ring_hand_commits where hand_id=p_hand and version=p_expected;
  if changed is null or p_timeout is null or (p_timeout and actor.sit_out_since is null and clock_timestamp()<changed+poker_private.ring_turn_interval()+extra) or (not p_timeout and clock_timestamp()>=changed+poker_private.ring_turn_interval()+extra) then raise exception 'Turn deadline changed';end if;
  if p_from is null or p_from not in(0,3,4,5) then raise exception 'Invalid board phase';end if;
  v:=poker_private.ring_hand_write(p_hand,p_expected,p_write,p_sealed,p_result);
  update poker_private.ring_fund_reservations set timeout_streak=case when p_timeout then least(3,timeout_streak+1) else 0 end,sit_out_since=case when p_timeout and timeout_streak>=2 then coalesce(sit_out_since,clock_timestamp()) else sit_out_since end where id=p_actor and status='seated';
  if p_result is not null then update poker_private.ring_fund_reservations set sit_out_hands=sit_out_hands+1 where table_id=tid and status='seated' and sit_out_since is not null;end if;
  if p_result is not null then update poker_private.ring_hands set runout_from=p_from where id=p_hand;end if;
 else v:=poker_private.ring_hand_write(p_hand,p_expected,p_write,p_sealed,p_result);
 end if;
 return v;
end;$$;

create or replace function poker_private.ring_ticket_timebank(p_member uuid,p_reservation uuid,p_hand uuid,p_revision bigint,p_request uuid) returns void language plpgsql security definer set search_path='' as $$
declare h poker_private.ring_hands%rowtype;changed timestamptz;prior jsonb;extra interval;
begin
 select * into h from poker_private.ring_hands where id=p_hand;
 if not found or p_request is null or p_revision is null or p_revision<0 or not poker_private.ring_member_eligible(p_member) then raise exception 'Hand unavailable';end if;
 perform 1 from public.poker_ring_tables where id=h.table_id for update;
 select * into h from poker_private.ring_hands where id=p_hand for update;
 if not exists(select 1 from jsonb_array_elements(h.participants) p where (p->>'memberId')::uuid=p_member and (p->>'reservationId')::uuid=p_reservation) then raise exception 'Not in hand';end if;
 prior:=h.ticket_used->(p_reservation::text||':'||p_revision::text);
 if prior is not null then
  if prior->>'request'=p_request::text then return;end if;
  raise exception 'Ticket already used';
 end if;
 if h.status<>'active' or h.version<>p_revision+1 or h.ticket_revision=h.version then raise exception 'Turn changed';end if;
 if not exists(select 1 from poker_private.ring_fund_reservations where id=p_reservation and member_id=p_member and table_id=h.table_id and status='seated' and sit_out_since is null) then raise exception 'Seat unavailable';end if;
 select created_at into changed from poker_private.ring_hand_commits where hand_id=h.id and version=h.version;
 extra:=case when h.bank_revision=h.version then interval '20 seconds' else interval '0 seconds' end;
 if changed is null or clock_timestamp()>=changed+poker_private.ring_turn_interval()+extra then raise exception 'Turn expired';end if;
 if not poker_private.ticket_use(p_member,'time_bank','bank:'||p_hand::text||':'||p_revision::text) then raise exception 'No ticket';end if;
 update poker_private.ring_hands set ticket_used=ticket_used||jsonb_build_object(p_reservation::text||':'||p_revision::text,jsonb_build_object('request',p_request)),ticket_revision=h.version where id=h.id;
end;$$;

create or replace function poker_private.ring_timebank(p_member uuid,p_reservation uuid,p_hand uuid,p_revision bigint,p_request uuid) returns void language plpgsql security definer set search_path='' as $$
declare h poker_private.ring_hands%rowtype;changed timestamptz;prior jsonb;
begin
 select * into h from poker_private.ring_hands where id=p_hand;
 if not found or p_request is null or p_revision is null or p_revision<0 or not poker_private.ring_member_eligible(p_member) then raise exception 'Hand unavailable';end if;
 perform 1 from public.poker_ring_tables where id=h.table_id for update;
 select * into h from poker_private.ring_hands where id=p_hand for update;
 if not exists(select 1 from jsonb_array_elements(h.participants) p where (p->>'memberId')::uuid=p_member and (p->>'reservationId')::uuid=p_reservation) then raise exception 'Not in hand';end if;
 prior:=h.bank_used->p_reservation::text;
 if prior is not null then
  if prior->>'request'=p_request::text and (prior->>'revision')::bigint=p_revision then return;end if;
  raise exception 'Timebank already used';
 end if;
 if h.status<>'active' or h.version<>p_revision+1 then raise exception 'Turn changed';end if;
 if not exists(select 1 from poker_private.ring_fund_reservations where id=p_reservation and member_id=p_member and table_id=h.table_id and status='seated') then raise exception 'Seat unavailable';end if;
 select created_at into changed from poker_private.ring_hand_commits where hand_id=h.id and version=h.version;
 if changed is null or clock_timestamp()>=changed+poker_private.ring_turn_interval()+interval '20 seconds' then raise exception 'Turn expired';end if;
 update poker_private.ring_hands set bank_used=bank_used||jsonb_build_object(p_reservation::text,jsonb_build_object('request',p_request,'revision',p_revision)),bank_revision=h.version where id=h.id;
end;$$;
