begin;
alter table poker_private.ring_hands add column bank_used jsonb not null default '{}'::jsonb;
alter table poker_private.ring_hands add column bank_revision bigint;
create or replace function poker_private.ring_play_meta(p_table uuid) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('context',poker_private.ring_context(p_table),'now',clock_timestamp(),'changedAt',(select c.created_at from poker_private.ring_hand_commits c where c.hand_id=h.id and c.version=h.version),'lastHandId',h.id,'completedAt',h.completed_at,'runoutFrom',h.runout_from,'bankRevision',case when h.bank_revision=h.version then h.bank_revision else null end,'bankUsed',coalesce((select jsonb_object_agg(key,value->>'request') from jsonb_each(h.bank_used)),'{}'::jsonb),
 'ready',coalesce((select jsonb_agg(r.id) from poker_private.ring_fund_reservations r where r.table_id=p_table and r.status='seated' and r.play_enabled and r.present_until>clock_timestamp() and r.exit_request is null),'[]'::jsonb))
 from (select 1) stub left join lateral(select * from poker_private.ring_hands where table_id=p_table order by created_at desc,id desc limit 1) h on true;
$$;
create or replace function poker_private.ring_play_write(p_hand uuid,p_expected bigint,p_write uuid,p_sealed jsonb,p_result jsonb,p_timeout boolean,p_from integer) returns bigint language plpgsql security definer set search_path='' as $$
declare tid uuid;changed timestamptz;v bigint;extra interval;
begin
 select table_id into tid from poker_private.ring_hands where id=p_hand;
 perform 1 from public.poker_ring_tables where id=tid for update;
 if not exists(select 1 from poker_private.ring_hand_commits where hand_id=p_hand and request_id=p_write) then
  select case when bank_revision=p_expected then interval '20 seconds' else interval '0 seconds' end into extra from poker_private.ring_hands where id=p_hand;
  select created_at into changed from poker_private.ring_hand_commits where hand_id=p_hand and version=p_expected;
  if changed is null or p_timeout is null or (p_timeout and clock_timestamp()<changed+interval '30 seconds'+extra) or (not p_timeout and clock_timestamp()>=changed+interval '30 seconds'+extra) then raise exception 'Turn deadline changed';end if;
  if p_from is null or p_from not in(0,3,4,5) then raise exception 'Invalid board phase';end if;
  v:=poker_private.ring_hand_write(p_hand,p_expected,p_write,p_sealed,p_result);
  if p_result is not null then update poker_private.ring_hands set runout_from=p_from where id=p_hand;end if;
 else v:=poker_private.ring_hand_write(p_hand,p_expected,p_write,p_sealed,p_result);
 end if;
 return v;
end;$$;
create or replace function poker_private.ring_seat_funds(p_member uuid,p_reservation uuid,p_seat integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare r poker_private.ring_fund_reservations%rowtype;t public.poker_ring_tables%rowtype;
begin
 select * into r from poker_private.ring_fund_reservations where id=p_reservation;
 if not found or p_member is null or r.member_id<>p_member then raise exception 'Reservation unavailable';end if;
 select * into t from public.poker_ring_tables where id=r.table_id for update;
 perform 1 from poker_private.ring_accounts where member_id=p_member for update;
 select * into r from poker_private.ring_fund_reservations where id=p_reservation for update;
 if p_seat is null or p_seat<1 or p_seat>t.capacity then raise exception 'Invalid seat';end if;
 if r.status='seated' and r.seat_number=p_seat then return to_jsonb(r);end if;
 if r.status<>'held' or r.expires_at<=now() or not t.published or t.deleted_at is not null or not poker_private.ring_member_eligible(p_member) then raise exception 'Seating unavailable';end if;
 if exists(select 1 from poker_private.ring_hands where table_id=t.id and status='active') then raise exception 'Hand in progress';end if;
 if exists(select 1 from poker_private.ring_fund_reservations where table_id=t.id and seat_number=p_seat and status='seated') then raise exception 'Seat occupied';end if;
 update poker_private.ring_fund_reservations set status='seated',seat_number=p_seat where id=r.id returning * into r;
 return to_jsonb(r);
end;$$;

-- Selection and debit are one transaction, including seat contention and retries.
create function poker_private.ring_choose_seat(p_member uuid,p_table uuid,p_amount bigint,p_request uuid,p_seat integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;t public.poker_ring_tables%rowtype;
begin
 select * into t from public.poker_ring_tables where id=p_table for update;
 if not found or p_seat is null or p_seat<1 or p_seat>t.capacity then raise exception 'Seat unavailable';end if;
 r:=poker_private.ring_reserve_funds(p_member,p_table,p_amount,p_request);
 if r->>'status'='returned' then return poker_private.ring_lobby_state(p_member,p_table);end if;
 if r->>'status'='seated' and (r->>'seat_number')::integer<>p_seat then raise exception 'Request conflict';end if;
 if r->>'status'='held' then
  if (r->>'expires_at')::timestamptz<=clock_timestamp() or not t.published or t.deleted_at is not null then raise exception 'Seating unavailable';end if;
  if exists(select 1 from poker_private.ring_fund_reservations where table_id=t.id and seat_number=p_seat and status='seated') then raise exception 'Seat occupied';end if;
  update poker_private.ring_fund_reservations set status='seated',seat_number=p_seat where id=p_request;
 end if;
 perform poker_private.ring_play_ready(p_member,p_request);
 return poker_private.ring_lobby_state(p_member,p_table);
end;$$;
create function poker_private.ring_timebank(p_member uuid,p_reservation uuid,p_hand uuid,p_revision bigint,p_request uuid) returns void language plpgsql security definer set search_path='' as $$
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
 if changed is null or clock_timestamp()>=changed+interval '30 seconds' then raise exception 'Turn expired';end if;
 update poker_private.ring_hands set bank_used=bank_used||jsonb_build_object(p_reservation::text,jsonb_build_object('request',p_request,'revision',p_revision)),bank_revision=h.version where id=h.id;
end;$$;
revoke all on function poker_private.ring_choose_seat(uuid,uuid,bigint,uuid,integer),poker_private.ring_timebank(uuid,uuid,uuid,bigint,uuid) from public,anon,authenticated;
grant execute on function poker_private.ring_choose_seat(uuid,uuid,bigint,uuid,integer),poker_private.ring_timebank(uuid,uuid,uuid,bigint,uuid) to service_role;
create function public.poker_ring_choose_seat(p_member uuid,p_table uuid,p_amount bigint,p_request uuid,p_seat integer) returns jsonb language sql security invoker set search_path='' as $$select poker_private.ring_choose_seat(p_member,p_table,p_amount,p_request,p_seat);$$;
create function public.poker_ring_timebank(p_member uuid,p_reservation uuid,p_hand uuid,p_revision bigint,p_request uuid) returns void language sql security invoker set search_path='' as $$select poker_private.ring_timebank(p_member,p_reservation,p_hand,p_revision,p_request);$$;
revoke all on function public.poker_ring_choose_seat(uuid,uuid,bigint,uuid,integer),public.poker_ring_timebank(uuid,uuid,uuid,bigint,uuid) from public,anon,authenticated;
grant execute on function public.poker_ring_choose_seat(uuid,uuid,bigint,uuid,integer),public.poker_ring_timebank(uuid,uuid,uuid,bigint,uuid) to service_role;
commit;
