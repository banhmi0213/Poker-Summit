-- Base turns are 20 seconds. Timebank still adds 20 seconds once per hand.
create or replace function poker_private.ring_play_write(p_hand uuid,p_expected bigint,p_write uuid,p_sealed jsonb,p_result jsonb,p_timeout boolean,p_from integer) returns bigint language plpgsql security definer set search_path='' as $$
declare tid uuid;changed timestamptz;v bigint;extra interval;
begin
 select table_id into tid from poker_private.ring_hands where id=p_hand;
 perform 1 from public.poker_ring_tables where id=tid for update;
 if not exists(select 1 from poker_private.ring_hand_commits where hand_id=p_hand and request_id=p_write) then
  select case when bank_revision=p_expected then interval '20 seconds' else interval '0 seconds' end into extra from poker_private.ring_hands where id=p_hand;
  select created_at into changed from poker_private.ring_hand_commits where hand_id=p_hand and version=p_expected;
  if changed is null or p_timeout is null or (p_timeout and clock_timestamp()<changed+interval '20 seconds'+extra) or (not p_timeout and clock_timestamp()>=changed+interval '20 seconds'+extra) then raise exception 'Turn deadline changed';end if;
  if p_from is null or p_from not in(0,3,4,5) then raise exception 'Invalid board phase';end if;
  v:=poker_private.ring_hand_write(p_hand,p_expected,p_write,p_sealed,p_result);
  if p_result is not null then update poker_private.ring_hands set runout_from=p_from where id=p_hand;end if;
 else v:=poker_private.ring_hand_write(p_hand,p_expected,p_write,p_sealed,p_result);
 end if;
 return v;
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
 if not exists(select 1 from poker_private.ring_fund_reservations where id=p_reservation and member_id=p_member and table_id=h.table_id and status='seated' and exit_request is null) then raise exception 'Seat unavailable';end if;
 select created_at into changed from poker_private.ring_hand_commits where hand_id=h.id and version=h.version;
 if changed is null or clock_timestamp()>=changed+interval '20 seconds' then raise exception 'Turn expired';end if;
 update poker_private.ring_hands set bank_used=bank_used||jsonb_build_object(p_reservation::text,jsonb_build_object('request',p_request,'revision',p_revision)),bank_revision=h.version where id=h.id;
end;$$;
