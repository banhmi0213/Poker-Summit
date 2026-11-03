begin;
-- Table row first, then accounts in member UUID order: one lock order for all funds paths.
alter table poker_private.ring_fund_reservations drop constraint ring_fund_reservations_status_check;
alter table poker_private.ring_fund_reservations add constraint ring_fund_reservations_status_check check(status in('held','seated','returned'));
alter table poker_private.ring_fund_reservations add column seat_number integer;
alter table poker_private.ring_fund_reservations add column table_stack bigint;
update poker_private.ring_fund_reservations set table_stack=case when status='returned' then 0 else amount end;
alter table poker_private.ring_fund_reservations alter column table_stack set not null;
alter table poker_private.ring_fund_reservations add constraint ring_table_stack_check check(table_stack between 0 and 4503599627370495 and (status<>'held' or table_stack=amount) and (status<>'returned' or table_stack=0));
alter table poker_private.ring_fund_reservations add constraint ring_seat_check check((status='seated' and seat_number is not null and seat_number between 1 and 6) or (status<>'seated' and seat_number is null));
drop index poker_private.ring_one_hold_per_member;
create unique index ring_one_hold_per_member on poker_private.ring_fund_reservations(member_id) where status in('held','seated');
create unique index ring_one_member_per_seat on poker_private.ring_fund_reservations(table_id,seat_number) where status='seated';
create index ring_pending_expiry on poker_private.ring_fund_reservations(table_id,expires_at) where status='held';
create table poker_private.ring_hands(
 id uuid primary key,table_id uuid not null references public.poker_ring_tables(id),version bigint not null check(version between 1 and 10000),
 button_seat integer not null check(button_seat between 1 and 6),participants jsonb not null check(jsonb_typeof(participants)='array'),terms jsonb not null,
 sealed jsonb not null,status text not null check(status in('active','complete')),result jsonb,
 created_at timestamptz not null default now(),completed_at timestamptz,
 check((status='complete')=(result is not null)),check((status='complete')=(completed_at is not null))
);
create unique index ring_one_active_hand on poker_private.ring_hands(table_id) where status='active';
create table poker_private.ring_hand_commits(
 hand_id uuid not null references poker_private.ring_hands(id),request_id uuid not null,version bigint not null,
 fingerprint bytea not null,created_at timestamptz not null default now(),primary key(hand_id,request_id),unique(hand_id,version)
);
alter table poker_private.ring_hands enable row level security;
alter table poker_private.ring_hand_commits enable row level security;
revoke all on poker_private.ring_hands,poker_private.ring_hand_commits from public,anon,authenticated,service_role;
grant select on poker_private.ring_hands,poker_private.ring_hand_commits to service_role;
create trigger ring_commit_immutable before update or delete on poker_private.ring_hand_commits for each row execute function poker_private.ring_preserve_ledger();
alter table poker_private.ring_chip_ledger add column hand_id uuid references poker_private.ring_hands(id);
alter table poker_private.ring_chip_ledger drop constraint ring_chip_ledger_kind_check;
alter table poker_private.ring_chip_ledger drop constraint ring_chip_ledger_check;
alter table poker_private.ring_chip_ledger add constraint ring_chip_ledger_kind_check check(kind in('welcome','reserve','refund','settlement','cashout'));
alter table poker_private.ring_chip_ledger add constraint ring_chip_ledger_check check(
 (kind='welcome' and available_delta=3000 and in_play_delta=0 and reservation_id is null and hand_id is null) or
 (kind='reserve' and available_delta<0 and in_play_delta=-available_delta and reservation_id is not null and hand_id is null) or
 (kind='refund' and available_delta>0 and in_play_delta=-available_delta and reservation_id is not null and hand_id is null) or
 (kind='cashout' and available_delta>=0 and in_play_delta=-available_delta and reservation_id is not null and hand_id is null) or
 (kind='settlement' and available_delta=0 and reservation_id is not null and hand_id is not null)
);
drop index poker_private.ring_one_reservation_event;
create unique index ring_one_reservation_event on poker_private.ring_chip_ledger(reservation_id,kind) where kind in('reserve','refund','cashout');
create unique index ring_one_hand_settlement on poker_private.ring_chip_ledger(hand_id,member_id) where kind='settlement';

create function poker_private.ring_member_eligible(p_member uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=p_member and u.email_confirmed_at is not null and u.deleted_at is null and not coalesce(u.is_anonymous,false) and u.email is not null and u.email not ilike '%@login.poker-summit.jp' and (u.banned_until is null or u.banned_until<now()) and not exists(select 1 from public.member_status s where s.user_id=u.id and s.suspended));
$$;
revoke all on function poker_private.ring_member_eligible(uuid) from public,anon,authenticated,service_role;
create or replace function poker_private.ring_reserve_funds(p_member uuid,p_table uuid,p_amount bigint,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.poker_ring_tables%rowtype;r poker_private.ring_fund_reservations%rowtype;a poker_private.ring_accounts%rowtype;
begin
 perform 1 from public.poker_ring_tables where id=p_table for update;
 if p_member is null or p_table is null then raise exception 'Invalid reservation';end if;
 if p_request is null or p_amount is null or p_amount<1 then raise exception 'Invalid reservation';end if;
 if not exists(select 1 from auth.users u where u.id=p_member and u.email_confirmed_at is not null and u.deleted_at is null and not coalesce(u.is_anonymous,false) and u.email is not null and u.email not ilike '%@login.poker-summit.jp' and (u.banned_until is null or u.banned_until<now()) and not exists(select 1 from public.member_status ms where ms.user_id=u.id and ms.suspended)) then raise exception 'Account unavailable';end if;
 perform poker_private.ensure_ring_welcome(p_member);
 select * into a from poker_private.ring_accounts where member_id=p_member for update;
 if not found then raise exception 'Account unavailable';end if;
 select * into r from poker_private.ring_fund_reservations where id=p_request;
 if found then
  if r.member_id<>p_member or r.table_id<>p_table or r.amount<>p_amount then raise exception 'Request conflict';end if;
  return to_jsonb(r);
 end if;
 select * into t from public.poker_ring_tables where id=p_table for update;
 if not found or not t.published or t.deleted_at is not null then raise exception 'Table unavailable';end if;
 if p_amount<t.min_buy_in or p_amount>t.max_buy_in then raise exception 'Buy-in outside range';end if;
 if a.available<p_amount then raise exception 'Insufficient chips';end if;
 if (select count(*) from poker_private.ring_fund_reservations where table_id=p_table and status in('held','seated'))>=t.capacity then raise exception 'Table full';end if;
 if exists(select 1 from poker_private.ring_fund_reservations where member_id=p_member and status in('held','seated')) then raise exception 'Member already reserved';end if;
 insert into poker_private.ring_fund_reservations(id,member_id,table_id,amount,table_stack) values(p_request,p_member,p_table,p_amount,p_amount) returning * into r;
 update poker_private.ring_accounts set available=available-p_amount,in_play=in_play+p_amount,updated_at=now() where member_id=p_member;
 insert into poker_private.ring_chip_ledger(member_id,request_id,kind,reservation_id,available_delta,in_play_delta) values(p_member,p_request,'reserve',p_request,-p_amount,p_amount);
 return to_jsonb(r);
end;$$;

create or replace function poker_private.ring_return_reserved_funds(p_reservation uuid,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r poker_private.ring_fund_reservations%rowtype;old_event poker_private.ring_chip_ledger%rowtype;
begin
 if p_request is null then raise exception 'Invalid request';end if;
 select * into r from poker_private.ring_fund_reservations where id=p_reservation;
 if not found then raise exception 'Reservation unavailable';end if;
 perform 1 from public.poker_ring_tables where id=r.table_id for update;
 perform 1 from poker_private.ring_accounts where member_id=r.member_id for update;
 select * into r from poker_private.ring_fund_reservations where id=p_reservation for update;
 select * into old_event from poker_private.ring_chip_ledger where member_id=r.member_id and request_id=p_request;
 if found and (old_event.kind<>'refund' or old_event.reservation_id<>r.id) then raise exception 'Request conflict';end if;
 if r.status='returned' then return to_jsonb(r);end if;
 if r.status<>'held' then raise exception 'Seated funds require cashout';end if;
 if exists(select 1 from poker_private.ring_accounts where member_id=r.member_id and in_play<r.amount) then raise exception 'Accounting mismatch';end if;
 update poker_private.ring_accounts set available=available+r.amount,in_play=in_play-r.amount,updated_at=now() where member_id=r.member_id;
 update poker_private.ring_fund_reservations set status='returned',returned_at=now(),table_stack=0 where id=r.id returning * into r;
 insert into poker_private.ring_chip_ledger(member_id,request_id,kind,reservation_id,available_delta,in_play_delta) values(r.member_id,p_request,'refund',r.id,r.amount,-r.amount);
 return to_jsonb(r);
end;$$;

create function poker_private.ring_context(p_table uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.poker_ring_tables%rowtype; seats jsonb;
begin
 select * into t from public.poker_ring_tables where id=p_table;
 if not found then raise exception 'Table unavailable';end if;
 select coalesce(jsonb_agg(jsonb_build_object('reservationId',id,'memberId',member_id,'seat',seat_number,'stack',table_stack) order by seat_number),'[]'::jsonb) into seats from poker_private.ring_fund_reservations where table_id=p_table and status='seated';
 return jsonb_build_object('tableId',t.id,'capacity',t.capacity,'terms',jsonb_build_object('sb',t.sb,'bb',t.bb),'seats',seats,'published',t.published and t.deleted_at is null,'buttonSeat',coalesce((select min(seat_number) from poker_private.ring_fund_reservations where table_id=p_table and status='seated' and seat_number>coalesce((select button_seat from poker_private.ring_hands where table_id=p_table order by created_at desc,id desc limit 1),0)),(select min(seat_number) from poker_private.ring_fund_reservations where table_id=p_table and status='seated')),'activeHandId',(select id from poker_private.ring_hands where table_id=p_table and status='active'));
end;$$;

create function poker_private.ring_seat_funds(p_member uuid,p_reservation uuid,p_seat integer) returns jsonb language plpgsql security definer set search_path='' as $$
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

create function poker_private.ring_cashout(p_member uuid,p_reservation uuid,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r poker_private.ring_fund_reservations%rowtype;e poker_private.ring_chip_ledger%rowtype;
begin
 if p_request is null then raise exception 'Invalid request';end if;
 select * into r from poker_private.ring_fund_reservations where id=p_reservation;
 if not found or p_member is null or r.member_id<>p_member then raise exception 'Reservation unavailable';end if;
 perform 1 from public.poker_ring_tables where id=r.table_id for update;
 perform 1 from poker_private.ring_accounts where member_id=p_member for update;
 select * into r from poker_private.ring_fund_reservations where id=p_reservation for update;
 select * into e from poker_private.ring_chip_ledger where member_id=p_member and request_id=p_request;
 if found and (e.kind<>'cashout' or e.reservation_id<>r.id) then raise exception 'Request conflict';end if;
 if r.status='returned' then
  if not exists(select 1 from poker_private.ring_chip_ledger where reservation_id=r.id and kind='cashout') then raise exception 'Reservation was cancelled';end if;
  return to_jsonb(r);
 end if;
 if r.status<>'seated' then raise exception 'Member not seated';end if;
 if exists(select 1 from poker_private.ring_hands where table_id=r.table_id and status='active') then raise exception 'Hand in progress';end if;
 if exists(select 1 from poker_private.ring_accounts where member_id=p_member and in_play<>r.table_stack) then raise exception 'Accounting mismatch';end if;
 update poker_private.ring_accounts set available=available+r.table_stack,in_play=in_play-r.table_stack,updated_at=now() where member_id=p_member;
 insert into poker_private.ring_chip_ledger(member_id,request_id,kind,reservation_id,available_delta,in_play_delta) values(p_member,p_request,'cashout',r.id,r.table_stack,-r.table_stack);
 update poker_private.ring_fund_reservations set status='returned',seat_number=null,table_stack=0,returned_at=now() where id=r.id returning * into r;
 return to_jsonb(r);
end;$$;

-- Only unseated funding holds expire. A disconnected player's seated stack is never refunded blindly.
create function poker_private.ring_release_expired(p_table uuid) returns integer language plpgsql security definer set search_path='' as $$
declare r record;released integer:=0;
begin
 perform 1 from public.poker_ring_tables where id=p_table for update;
 for r in select id from poker_private.ring_fund_reservations where table_id=p_table and status='held' and expires_at<=now() order by member_id limit 64 loop
  perform poker_private.ring_return_reserved_funds(r.id,gen_random_uuid());released:=released+1;
 end loop;
 return released;
end;$$;

create function poker_private.ring_validate_sealed(p_sealed jsonb) returns void language plpgsql set search_path='' as $$begin
 if p_sealed is null or jsonb_typeof(p_sealed)<>'object' or p_sealed->>'format' is distinct from '1' or jsonb_typeof(p_sealed->'keyId') is distinct from 'string' or jsonb_typeof(p_sealed->'iv') is distinct from 'string' or jsonb_typeof(p_sealed->'tag') is distinct from 'string' or jsonb_typeof(p_sealed->'data') is distinct from 'string' or octet_length(p_sealed::text)>3000000 then raise exception 'Invalid encrypted hand';end if;
end;$$;

-- Caller holds table lock. Terminal checkpoint, all balances and all receipts commit in ONE transaction.
create function poker_private.ring_apply_result(p_hand uuid,p_write uuid,p_result jsonb) returns void language plpgsql set search_path='' as $$
declare h poker_private.ring_hands%rowtype;entry jsonb;value jsonb;r poker_private.ring_fund_reservations%rowtype;total_before numeric:=0;total_after numeric:=0;new_stack bigint;
begin
 if p_result is null then return;end if;
 select * into h from poker_private.ring_hands where id=p_hand;
 if h.status<>'active' or jsonb_typeof(p_result) is distinct from 'array' or jsonb_array_length(p_result)<>jsonb_array_length(h.participants) then raise exception 'Invalid hand result';end if;
 if exists(select 1 from jsonb_array_elements(p_result) v where jsonb_typeof(v) is distinct from 'object' or jsonb_typeof(v->'stack') is distinct from 'number' or (v->>'stack')!~'^[0-9]+$') or (select count(distinct v->>'reservationId') from jsonb_array_elements(p_result) v)<>jsonb_array_length(p_result) then raise exception 'Invalid hand result';end if;
 perform 1 from poker_private.ring_accounts where member_id in(select (v->>'memberId')::uuid from jsonb_array_elements(h.participants) v) order by member_id for update;
 for entry in select * from jsonb_array_elements(h.participants) loop
  select v into value from jsonb_array_elements(p_result) v where v->>'reservationId'=entry->>'reservationId';
  if value is null then raise exception 'Participant mismatch';end if;
  new_stack:=(value->>'stack')::bigint;
  if new_stack<0 or new_stack>4503599627370495 then raise exception 'Invalid hand result';end if;
  select * into r from poker_private.ring_fund_reservations where id=(entry->>'reservationId')::uuid for update;
  if r.status<>'seated' or r.table_id<>h.table_id or r.member_id<>(entry->>'memberId')::uuid or r.table_stack<>(entry->>'stack')::bigint or (select in_play from poker_private.ring_accounts where member_id=r.member_id)<>r.table_stack then raise exception 'Accounting mismatch';end if;
  total_before:=total_before+r.table_stack;total_after:=total_after+new_stack;
 end loop;
 if total_before<>total_after then raise exception 'Chip total changed';end if;
 for entry in select * from jsonb_array_elements(h.participants) loop
  select v into value from jsonb_array_elements(p_result) v where v->>'reservationId'=entry->>'reservationId';new_stack:=(value->>'stack')::bigint;
  update poker_private.ring_accounts set in_play=new_stack,updated_at=now() where member_id=(entry->>'memberId')::uuid;
  update poker_private.ring_fund_reservations set table_stack=new_stack where id=(entry->>'reservationId')::uuid;
  insert into poker_private.ring_chip_ledger(member_id,request_id,kind,reservation_id,hand_id,available_delta,in_play_delta) values((entry->>'memberId')::uuid,p_write,'settlement',(entry->>'reservationId')::uuid,p_hand,0,new_stack-(entry->>'stack')::bigint);
 end loop;
 update poker_private.ring_hands set status='complete',result=p_result,completed_at=now() where id=p_hand;
end;$$;

create function poker_private.ring_hand_begin(p_table uuid,p_hand uuid,p_roster jsonb,p_terms jsonb,p_sealed jsonb,p_result jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare ctx jsonb;fingerprint bytea;receipt poker_private.ring_hand_commits%rowtype;
begin
 if p_hand is null then raise exception 'Invalid hand';end if;
 perform 1 from public.poker_ring_tables where id=p_table for update;
 perform poker_private.ring_validate_sealed(p_sealed);
 fingerprint:=extensions.digest(convert_to(jsonb_build_array('begin',p_table,p_roster,p_terms,p_sealed,p_result)::text,'UTF8'),'sha256');
 select * into receipt from poker_private.ring_hand_commits where hand_id=p_hand and request_id=p_hand;
 if found then if receipt.fingerprint<>fingerprint then raise exception 'Request conflict';end if;return receipt.version;end if;
 ctx:=poker_private.ring_context(p_table);
 if not (ctx->>'published')::boolean or ctx->>'activeHandId' is not null then raise exception 'Table unavailable';end if;
 if p_roster is null or p_terms is null or p_roster<>ctx->'seats' or p_terms<>ctx->'terms' or jsonb_array_length(p_roster)<2 then raise exception 'Seating changed';end if;
 if exists(select 1 from jsonb_array_elements(p_roster) v where (v->>'stack')::bigint<1 or not poker_private.ring_member_eligible((v->>'memberId')::uuid)) then raise exception 'Player unavailable';end if;
 insert into poker_private.ring_hands(id,table_id,version,button_seat,participants,terms,sealed,status) values(p_hand,p_table,1,(ctx->>'buttonSeat')::integer,p_roster,p_terms,p_sealed,'active');
 perform poker_private.ring_apply_result(p_hand,p_hand,p_result);
 insert into poker_private.ring_hand_commits(hand_id,request_id,version,fingerprint) values(p_hand,p_hand,1,fingerprint);
 return 1;
end;$$;

create function poker_private.ring_hand_write(p_hand uuid,p_expected bigint,p_write uuid,p_sealed jsonb,p_result jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare h poker_private.ring_hands%rowtype;receipt poker_private.ring_hand_commits%rowtype;fingerprint bytea;
begin
 if p_write is null or p_expected is null or p_expected<1 or p_expected>=10000 then raise exception 'Invalid write';end if;
 select * into h from poker_private.ring_hands where id=p_hand;
 if not found then raise exception 'Hand unavailable';end if;
 perform 1 from public.poker_ring_tables where id=h.table_id for update;
 select * into h from poker_private.ring_hands where id=p_hand for update;
 perform poker_private.ring_validate_sealed(p_sealed);
 fingerprint:=extensions.digest(convert_to(jsonb_build_array('write',p_expected,p_sealed,p_result)::text,'UTF8'),'sha256');
 select * into receipt from poker_private.ring_hand_commits where hand_id=p_hand and request_id=p_write;
 if found then if receipt.fingerprint<>fingerprint then raise exception 'Request conflict';end if;return receipt.version;end if;
 if h.version<>p_expected or h.status<>'active' then raise exception 'Stale hand version';end if;
 perform poker_private.ring_apply_result(p_hand,p_write,p_result);
 update poker_private.ring_hands set sealed=p_sealed,version=p_expected+1 where id=p_hand;
 insert into poker_private.ring_hand_commits(hand_id,request_id,version,fingerprint) values(p_hand,p_write,p_expected+1,fingerprint);
 return p_expected+1;
end;$$;

create function poker_private.ring_hand_load(p_hand uuid) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('handId',id,'tableId',table_id,'version',version,'buttonSeat',button_seat,'seats',participants,'terms',terms,'sealed',sealed,'status',status,'result',result) from poker_private.ring_hands where id=p_hand;
$$;

create or replace function poker_private.ring_guard_table_settings() returns trigger language plpgsql security definer set search_path='' as $$begin
 if (new.deleted_at is distinct from old.deleted_at or new.published is distinct from old.published or new.sb<>old.sb or new.bb<>old.bb or new.capacity<>old.capacity or new.min_buy_in<>old.min_buy_in or new.max_buy_in<>old.max_buy_in) and exists(select 1 from poker_private.ring_fund_reservations where table_id=old.id and status in('held','seated')) then raise exception 'Table has reserved funds';end if;return new;
end;$$;

-- Deny every helper by default. Only the listed service-role entry points are exposed.
revoke all on function poker_private.ring_context(uuid) from public,anon,authenticated;
grant execute on function poker_private.ring_context(uuid) to service_role;
create function public.poker_ring_context(p_table uuid) returns jsonb language sql security invoker set search_path='' as $$select poker_private.ring_context(p_table);$$;
revoke all on function public.poker_ring_context(uuid) from public,anon,authenticated;
grant execute on function public.poker_ring_context(uuid) to service_role;
revoke all on function poker_private.ring_seat_funds(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function poker_private.ring_seat_funds(uuid,uuid,integer) to service_role;
create function public.poker_ring_seat_funds(p_member uuid,p_reservation uuid,p_seat integer) returns jsonb language sql security invoker set search_path='' as $$select poker_private.ring_seat_funds(p_member,p_reservation,p_seat);$$;
revoke all on function public.poker_ring_seat_funds(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.poker_ring_seat_funds(uuid,uuid,integer) to service_role;
revoke all on function poker_private.ring_cashout(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function poker_private.ring_cashout(uuid,uuid,uuid) to service_role;
create function public.poker_ring_cashout(p_member uuid,p_reservation uuid,p_request uuid) returns jsonb language sql security invoker set search_path='' as $$select poker_private.ring_cashout(p_member,p_reservation,p_request);$$;
revoke all on function public.poker_ring_cashout(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.poker_ring_cashout(uuid,uuid,uuid) to service_role;
revoke all on function poker_private.ring_release_expired(uuid) from public,anon,authenticated;
grant execute on function poker_private.ring_release_expired(uuid) to service_role;
create function public.poker_ring_release_expired(p_table uuid) returns integer language sql security invoker set search_path='' as $$select poker_private.ring_release_expired(p_table);$$;
revoke all on function public.poker_ring_release_expired(uuid) from public,anon,authenticated;
grant execute on function public.poker_ring_release_expired(uuid) to service_role;
revoke all on function poker_private.ring_hand_begin(uuid,uuid,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function poker_private.ring_hand_begin(uuid,uuid,jsonb,jsonb,jsonb,jsonb) to service_role;
create function public.poker_ring_hand_begin(p_table uuid,p_hand uuid,p_roster jsonb,p_terms jsonb,p_sealed jsonb,p_result jsonb) returns bigint language sql security invoker set search_path='' as $$select poker_private.ring_hand_begin(p_table,p_hand,p_roster,p_terms,p_sealed,p_result);$$;
revoke all on function public.poker_ring_hand_begin(uuid,uuid,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.poker_ring_hand_begin(uuid,uuid,jsonb,jsonb,jsonb,jsonb) to service_role;
revoke all on function poker_private.ring_hand_write(uuid,bigint,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function poker_private.ring_hand_write(uuid,bigint,uuid,jsonb,jsonb) to service_role;
create function public.poker_ring_hand_write(p_hand uuid,p_expected bigint,p_write uuid,p_sealed jsonb,p_result jsonb) returns bigint language sql security invoker set search_path='' as $$select poker_private.ring_hand_write(p_hand,p_expected,p_write,p_sealed,p_result);$$;
revoke all on function public.poker_ring_hand_write(uuid,bigint,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.poker_ring_hand_write(uuid,bigint,uuid,jsonb,jsonb) to service_role;
revoke all on function poker_private.ring_hand_load(uuid) from public,anon,authenticated;
grant execute on function poker_private.ring_hand_load(uuid) to service_role;
create function public.poker_ring_hand_load(p_hand uuid) returns jsonb language sql security invoker set search_path='' as $$select poker_private.ring_hand_load(p_hand);$$;
revoke all on function public.poker_ring_hand_load(uuid) from public,anon,authenticated;
grant execute on function public.poker_ring_hand_load(uuid) to service_role;
revoke all on function poker_private.ring_validate_sealed(jsonb),poker_private.ring_apply_result(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
commit;
