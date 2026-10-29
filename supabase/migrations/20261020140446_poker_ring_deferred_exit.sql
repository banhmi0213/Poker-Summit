begin;
-- An exit belongs to one reservation. Keep its receipt after returning funds so
-- a delayed retry cannot withdraw chips from a later seat.
alter table poker_private.ring_fund_reservations add column exit_request uuid;
alter table poker_private.ring_fund_reservations add constraint ring_exit_seated check(exit_request is null or status in('seated','returned'));

create or replace function poker_private.ring_depart(p_member uuid,p_reservation uuid,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r poker_private.ring_fund_reservations%rowtype;
begin
 if p_request is null then raise exception 'Invalid request';end if;
 select * into r from poker_private.ring_fund_reservations where id=p_reservation;
 if not found or p_member is null or r.member_id<>p_member then raise exception 'Reservation unavailable';end if;
 perform 1 from public.poker_ring_tables where id=r.table_id for update;
 select * into r from poker_private.ring_fund_reservations where id=p_reservation for update;
 if r.status='seated' and exists(select 1 from poker_private.ring_hands where table_id=r.table_id and status='active') then
  if r.exit_request is null then
   if exists(select 1 from poker_private.ring_chip_ledger where member_id=p_member and request_id=p_request) then raise exception 'Request conflict';end if;
   update poker_private.ring_fund_reservations set exit_request=p_request where id=r.id;
  end if;
 elsif r.status='held' or (r.status='returned' and exists(select 1 from poker_private.ring_chip_ledger where reservation_id=r.id and kind='refund')) then
  perform poker_private.ring_return_reserved_funds(r.id,p_request);
 else perform poker_private.ring_cashout(p_member,r.id,coalesce(r.exit_request,p_request));
 end if;
 return poker_private.ring_lobby_state(p_member,r.table_id);
end;$$;

-- ring_apply_result updates every participant's final stack before marking the
-- hand complete. Return pending exits in that SAME transaction, under its table
-- and account locks. A failed payout rolls back both the result and the exits.
create function poker_private.ring_finish_exits() returns trigger language plpgsql set search_path='' as $$
declare r record;
begin
 if old.status='active' and new.status='complete' then
  for r in select id,member_id,exit_request from poker_private.ring_fund_reservations where table_id=new.table_id and status='seated' and exit_request is not null order by member_id loop
   perform poker_private.ring_cashout(r.member_id,r.id,r.exit_request);
  end loop;
 end if;
 return new;
end;$$;
revoke all on function poker_private.ring_finish_exits() from public,anon,authenticated;
create trigger ring_finish_exits after update of status on poker_private.ring_hands for each row execute function poker_private.ring_finish_exits();
create or replace function poker_private.ring_lobby_state(p_member uuid,p_table uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare membership jsonb;wallet jsonb;catalog jsonb;selected jsonb;
begin
 if not poker_private.ring_member_eligible(p_member) then raise exception 'Account unavailable';end if;
 perform poker_private.ensure_ring_welcome(p_member);
 select jsonb_build_object('available',available,'inPlay',in_play,'total',available+in_play) into wallet from poker_private.ring_accounts where member_id=p_member;
 select jsonb_build_object('reservationId',r.id,'tableId',r.table_id,'seat',r.seat_number,'stack',r.table_stack,'status',r.status,'title',t.title,'exitRequested',r.exit_request is not null) into membership from poker_private.ring_fund_reservations r join public.poker_ring_tables t on t.id=r.table_id where r.member_id=p_member and r.status in('held','seated');
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into catalog from(select id,title,capacity,sb,bb,min_buy_in as "minBuyIn",max_buy_in as "maxBuyIn",(select count(*) from poker_private.ring_fund_reservations r where r.table_id=rt.id and r.status in('held','seated')) as occupied from public.poker_ring_tables rt where published and deleted_at is null order by sort_order,created_at,id limit 100) t;
 select jsonb_build_object('id',t.id,'title',t.title,'capacity',t.capacity,'sb',t.sb,'bb',t.bb,'minBuyIn',t.min_buy_in,'maxBuyIn',t.max_buy_in,
 'playing',exists(select 1 from poker_private.ring_hands h where h.table_id=t.id and h.status='active'),
 'seats',coalesce((select jsonb_agg(jsonb_build_object('seat',r.seat_number,'stack',r.table_stack) order by r.seat_number) from poker_private.ring_fund_reservations r where r.table_id=t.id and r.status='seated'),'[]'::jsonb)) into selected from public.poker_ring_tables t where t.id=p_table and t.published and t.deleted_at is null;
 return jsonb_build_object('membership',membership,'wallet',coalesce(wallet,jsonb_build_object('available',0,'inPlay',0,'total',0)),'tables',catalog,'table',selected);
end;$$;


commit;
