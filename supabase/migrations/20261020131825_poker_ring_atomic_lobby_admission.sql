begin;
create function poker_private.ring_lobby_state(p_member uuid,p_table uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare membership jsonb;wallet jsonb;catalog jsonb;selected jsonb;
begin
 if not poker_private.ring_member_eligible(p_member) then raise exception 'Account unavailable';end if;
 perform poker_private.ensure_ring_welcome(p_member);
 select jsonb_build_object('available',available,'inPlay',in_play,'total',available+in_play) into wallet from poker_private.ring_accounts where member_id=p_member;
 select jsonb_build_object('reservationId',r.id,'tableId',r.table_id,'seat',r.seat_number,'stack',r.table_stack,'status',r.status,'title',t.title) into membership from poker_private.ring_fund_reservations r join public.poker_ring_tables t on t.id=r.table_id where r.member_id=p_member and r.status in('held','seated');
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into catalog from(select id,title,capacity,sb,bb,min_buy_in as "minBuyIn",max_buy_in as "maxBuyIn",(select count(*) from poker_private.ring_fund_reservations r where r.table_id=rt.id and r.status in('held','seated')) as occupied from public.poker_ring_tables rt where published and deleted_at is null order by sort_order,created_at,id limit 100) t;
 select jsonb_build_object('id',t.id,'title',t.title,'capacity',t.capacity,'sb',t.sb,'bb',t.bb,'minBuyIn',t.min_buy_in,'maxBuyIn',t.max_buy_in,
 'playing',exists(select 1 from poker_private.ring_hands h where h.table_id=t.id and h.status='active'),
 'seats',coalesce((select jsonb_agg(jsonb_build_object('seat',r.seat_number,'stack',r.table_stack) order by r.seat_number) from poker_private.ring_fund_reservations r where r.table_id=t.id and r.status='seated'),'[]'::jsonb)) into selected from public.poker_ring_tables t where t.id=p_table and t.published and t.deleted_at is null;
 return jsonb_build_object('membership',membership,'wallet',coalesce(wallet,jsonb_build_object('available',0,'inPlay',0,'total',0)),'tables',catalog,'table',selected);
end;$$;

-- One transaction: failed seat acceptance rolls back the hold and debit as well.
create function poker_private.ring_admit(p_member uuid,p_table uuid,p_amount bigint,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;seat integer;t public.poker_ring_tables%rowtype;
begin
 select * into t from public.poker_ring_tables where id=p_table for update;
 if not found then raise exception 'Table unavailable';end if;
 r:=poker_private.ring_reserve_funds(p_member,p_table,p_amount,p_request);
 if r->>'status'='returned' then return poker_private.ring_lobby_state(p_member,p_table);end if;
 if r->>'status'='held' then
  select n into seat from generate_series(1,t.capacity) n where not exists(select 1 from poker_private.ring_fund_reservations h where h.table_id=p_table and h.status='seated' and h.seat_number=n) order by n limit 1;
  if seat is null then raise exception 'Table full';end if;
  perform poker_private.ring_seat_funds(p_member,p_request,seat);
 end if;
 return poker_private.ring_lobby_state(p_member,p_table);
end;$$;

create function poker_private.ring_depart(p_member uuid,p_reservation uuid,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r poker_private.ring_fund_reservations%rowtype;
begin
 select * into r from poker_private.ring_fund_reservations where id=p_reservation;
 if not found or p_member is null or r.member_id<>p_member then raise exception 'Reservation unavailable';end if;
 perform 1 from public.poker_ring_tables where id=r.table_id for update;
 select * into r from poker_private.ring_fund_reservations where id=p_reservation;
 if r.status='held' or (r.status='returned' and exists(select 1 from poker_private.ring_chip_ledger where reservation_id=r.id and kind='refund')) then
  perform poker_private.ring_return_reserved_funds(r.id,p_request);
 else perform poker_private.ring_cashout(p_member,r.id,p_request);
 end if;
 return poker_private.ring_lobby_state(p_member,r.table_id);
end;$$;
revoke all on function poker_private.ring_lobby_state(uuid,uuid),poker_private.ring_admit(uuid,uuid,bigint,uuid),poker_private.ring_depart(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function poker_private.ring_lobby_state(uuid,uuid),poker_private.ring_admit(uuid,uuid,bigint,uuid),poker_private.ring_depart(uuid,uuid,uuid) to service_role;
create function public.poker_ring_lobby_state(p_member uuid,p_table uuid default null) returns jsonb language sql security invoker set search_path='' as $$select poker_private.ring_lobby_state(p_member,p_table);$$;
create function public.poker_ring_admit(p_member uuid,p_table uuid,p_amount bigint,p_request uuid) returns jsonb language sql security invoker set search_path='' as $$select poker_private.ring_admit(p_member,p_table,p_amount,p_request);$$;
create function public.poker_ring_depart(p_member uuid,p_reservation uuid,p_request uuid) returns jsonb language sql security invoker set search_path='' as $$select poker_private.ring_depart(p_member,p_reservation,p_request);$$;
revoke all on function public.poker_ring_lobby_state(uuid,uuid),public.poker_ring_admit(uuid,uuid,bigint,uuid),public.poker_ring_depart(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.poker_ring_lobby_state(uuid,uuid),public.poker_ring_admit(uuid,uuid,bigint,uuid),public.poker_ring_depart(uuid,uuid,uuid) to service_role;
commit;
