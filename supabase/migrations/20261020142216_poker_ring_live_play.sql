begin;
alter table poker_private.ring_fund_reservations add column play_enabled boolean not null default false;
alter table poker_private.ring_fund_reservations add column present_until timestamptz;
alter table poker_private.ring_hands add column runout_from smallint check(runout_from in(0,3,4,5));

create function poker_private.ring_play_ready(p_member uuid,p_reservation uuid) returns void language plpgsql security definer set search_path='' as $$
declare r poker_private.ring_fund_reservations%rowtype;
begin
 select * into r from poker_private.ring_fund_reservations where id=p_reservation;
 if not found or p_member is null or r.member_id<>p_member or not poker_private.ring_member_eligible(p_member) then raise exception 'Seat unavailable';end if;
 perform 1 from public.poker_ring_tables where id=r.table_id for update;
 update poker_private.ring_fund_reservations set play_enabled=true,present_until=clock_timestamp()+interval '20 seconds' where id=r.id and status='seated' and exit_request is null;
end;$$;
create function poker_private.ring_play_ping(p_member uuid,p_table uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not poker_private.ring_member_eligible(p_member) then raise exception 'Account unavailable';end if;
 perform 1 from public.poker_ring_tables where id=p_table for update;
 update poker_private.ring_fund_reservations set present_until=clock_timestamp()+interval '20 seconds' where member_id=p_member and table_id=p_table and status='seated' and play_enabled;
end;$$;
create function poker_private.ring_play_meta(p_table uuid) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('context',poker_private.ring_context(p_table),'now',clock_timestamp(),'changedAt',(select c.created_at from poker_private.ring_hand_commits c where c.hand_id=h.id and c.version=h.version),'lastHandId',h.id,'completedAt',h.completed_at,'runoutFrom',h.runout_from,
 'ready',coalesce((select jsonb_agg(r.id) from poker_private.ring_fund_reservations r where r.table_id=p_table and r.status='seated' and r.play_enabled and r.present_until>clock_timestamp() and r.exit_request is null),'[]'::jsonb))
 from (select 1) stub left join lateral(select * from poker_private.ring_hands where table_id=p_table order by created_at desc,id desc limit 1) h on true;
$$;
create function poker_private.ring_play_tables(p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if p_limit is null or p_limit<1 or p_limit>128 then raise exception 'Invalid limit';end if;
 return coalesce((select jsonb_agg(t.id) from(select id from public.poker_ring_tables t where exists(select 1 from poker_private.ring_hands h where h.table_id=t.id and h.status='active') or exists(select 1 from poker_private.ring_fund_reservations r where r.table_id=t.id and r.status='seated' and r.play_enabled) order by t.created_at,t.id limit p_limit) t),'[]'::jsonb);
end;$$;
create function poker_private.ring_play_begin(p_table uuid,p_hand uuid,p_roster jsonb,p_terms jsonb,p_sealed jsonb,p_result jsonb) returns bigint language plpgsql security definer set search_path='' as $$begin
 perform 1 from public.poker_ring_tables where id=p_table for update;
 if not exists(select 1 from poker_private.ring_hand_commits where hand_id=p_hand and request_id=p_hand) then
  if exists(select 1 from poker_private.ring_fund_reservations where table_id=p_table and status='seated' and (not play_enabled or present_until is null or present_until<=clock_timestamp() or exit_request is not null)) then raise exception 'Players not ready';end if;
  if exists(select 1 from poker_private.ring_hands where table_id=p_table and status='complete' and completed_at>clock_timestamp()-interval '15 seconds') then raise exception 'Presentation in progress';end if;
 end if;
 return poker_private.ring_hand_begin(p_table,p_hand,p_roster,p_terms,p_sealed,p_result);
end;$$;
create function poker_private.ring_play_write(p_hand uuid,p_expected bigint,p_write uuid,p_sealed jsonb,p_result jsonb,p_timeout boolean,p_from integer) returns bigint language plpgsql security definer set search_path='' as $$
declare tid uuid;changed timestamptz;v bigint;
begin
 select table_id into tid from poker_private.ring_hands where id=p_hand;
 perform 1 from public.poker_ring_tables where id=tid for update;
 if not exists(select 1 from poker_private.ring_hand_commits where hand_id=p_hand and request_id=p_write) then
  select created_at into changed from poker_private.ring_hand_commits where hand_id=p_hand and version=p_expected;
  if changed is null or p_timeout is null or (p_timeout and clock_timestamp()<changed+interval '30 seconds') or (not p_timeout and clock_timestamp()>=changed+interval '30 seconds') then raise exception 'Turn deadline changed';end if;
  if p_from is null or p_from not in(0,3,4,5) then raise exception 'Invalid board phase';end if;
  v:=poker_private.ring_hand_write(p_hand,p_expected,p_write,p_sealed,p_result);
  if p_result is not null then update poker_private.ring_hands set runout_from=p_from where id=p_hand;end if;
 else v:=poker_private.ring_hand_write(p_hand,p_expected,p_write,p_sealed,p_result);
 end if;
 return v;
end;$$;
create or replace function poker_private.ring_lobby_state(p_member uuid,p_table uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare membership jsonb;wallet jsonb;catalog jsonb;selected jsonb;
begin
 if not poker_private.ring_member_eligible(p_member) then raise exception 'Account unavailable';end if;
 perform poker_private.ensure_ring_welcome(p_member);
 select jsonb_build_object('available',available,'inPlay',in_play,'total',available+in_play) into wallet from poker_private.ring_accounts where member_id=p_member;
 select jsonb_build_object('reservationId',r.id,'tableId',r.table_id,'seat',r.seat_number,'stack',r.table_stack,'status',r.status,'title',t.title,'exitRequested',r.exit_request is not null,'playEnabled',r.play_enabled) into membership from poker_private.ring_fund_reservations r join public.poker_ring_tables t on t.id=r.table_id where r.member_id=p_member and r.status in('held','seated');
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into catalog from(select id,title,capacity,sb,bb,min_buy_in as "minBuyIn",max_buy_in as "maxBuyIn",(select count(*) from poker_private.ring_fund_reservations r where r.table_id=rt.id and r.status in('held','seated')) as occupied from public.poker_ring_tables rt where published and deleted_at is null order by sort_order,created_at,id limit 100) t;
 select jsonb_build_object('id',t.id,'title',t.title,'capacity',t.capacity,'sb',t.sb,'bb',t.bb,'minBuyIn',t.min_buy_in,'maxBuyIn',t.max_buy_in,
 'playing',exists(select 1 from poker_private.ring_hands h where h.table_id=t.id and h.status='active'),
 'seats',coalesce((select jsonb_agg(jsonb_build_object('seat',r.seat_number,'stack',r.table_stack) order by r.seat_number) from poker_private.ring_fund_reservations r where r.table_id=t.id and r.status='seated'),'[]'::jsonb)) into selected from public.poker_ring_tables t where t.id=p_table and t.published and t.deleted_at is null;
 return jsonb_build_object('membership',membership,'wallet',coalesce(wallet,jsonb_build_object('available',0,'inPlay',0,'total',0)),'tables',catalog,'table',selected);
end;$$;



revoke all on function poker_private.ring_play_ready(uuid,uuid) from public,anon,authenticated;
grant execute on function poker_private.ring_play_ready(uuid,uuid) to service_role;
create function public.poker_ring_play_ready(p_member uuid,p_reservation uuid) returns void language sql security invoker set search_path='' as $$select poker_private.ring_play_ready(p_member,p_reservation);$$;
revoke all on function public.poker_ring_play_ready(uuid,uuid) from public,anon,authenticated;
grant execute on function public.poker_ring_play_ready(uuid,uuid) to service_role;

revoke all on function poker_private.ring_play_ping(uuid,uuid) from public,anon,authenticated;
grant execute on function poker_private.ring_play_ping(uuid,uuid) to service_role;
create function public.poker_ring_play_ping(p_member uuid,p_table uuid) returns void language sql security invoker set search_path='' as $$select poker_private.ring_play_ping(p_member,p_table);$$;
revoke all on function public.poker_ring_play_ping(uuid,uuid) from public,anon,authenticated;
grant execute on function public.poker_ring_play_ping(uuid,uuid) to service_role;

revoke all on function poker_private.ring_play_meta(uuid) from public,anon,authenticated;
grant execute on function poker_private.ring_play_meta(uuid) to service_role;
create function public.poker_ring_play_meta(p_table uuid) returns jsonb language sql security invoker set search_path='' as $$select poker_private.ring_play_meta(p_table);$$;
revoke all on function public.poker_ring_play_meta(uuid) from public,anon,authenticated;
grant execute on function public.poker_ring_play_meta(uuid) to service_role;

revoke all on function poker_private.ring_play_tables(integer) from public,anon,authenticated;
grant execute on function poker_private.ring_play_tables(integer) to service_role;
create function public.poker_ring_play_tables(p_limit integer) returns jsonb language sql security invoker set search_path='' as $$select poker_private.ring_play_tables(p_limit);$$;
revoke all on function public.poker_ring_play_tables(integer) from public,anon,authenticated;
grant execute on function public.poker_ring_play_tables(integer) to service_role;

revoke all on function poker_private.ring_play_begin(uuid,uuid,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function poker_private.ring_play_begin(uuid,uuid,jsonb,jsonb,jsonb,jsonb) to service_role;
create function public.poker_ring_play_begin(p_table uuid,p_hand uuid,p_roster jsonb,p_terms jsonb,p_sealed jsonb,p_result jsonb) returns bigint language sql security invoker set search_path='' as $$select poker_private.ring_play_begin(p_table,p_hand,p_roster,p_terms,p_sealed,p_result);$$;
revoke all on function public.poker_ring_play_begin(uuid,uuid,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.poker_ring_play_begin(uuid,uuid,jsonb,jsonb,jsonb,jsonb) to service_role;

revoke all on function poker_private.ring_play_write(uuid,bigint,uuid,jsonb,jsonb,boolean,integer) from public,anon,authenticated;
grant execute on function poker_private.ring_play_write(uuid,bigint,uuid,jsonb,jsonb,boolean,integer) to service_role;
create function public.poker_ring_play_write(p_hand uuid,p_expected bigint,p_write uuid,p_sealed jsonb,p_result jsonb,p_timeout boolean,p_from integer) returns bigint language sql security invoker set search_path='' as $$select poker_private.ring_play_write(p_hand,p_expected,p_write,p_sealed,p_result,p_timeout,p_from);$$;
revoke all on function public.poker_ring_play_write(uuid,bigint,uuid,jsonb,jsonb,boolean,integer) from public,anon,authenticated;
grant execute on function public.poker_ring_play_write(uuid,bigint,uuid,jsonb,jsonb,boolean,integer) to service_role;
commit;
