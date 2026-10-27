-- Departure is deferred until settlement; current-hand timebank remains available.
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
 if changed is null or clock_timestamp()>=changed+interval '20 seconds' then raise exception 'Turn expired';end if;
 update poker_private.ring_hands set bank_used=bank_used||jsonb_build_object(p_reservation::text,jsonb_build_object('request',p_request,'revision',p_revision)),bank_revision=h.version where id=h.id;
end;$$;
