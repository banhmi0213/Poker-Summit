begin;
alter table poker_private.ring_fund_reservations add column timeout_streak smallint not null default 0 check(timeout_streak between 0 and 3),add column sit_out_since timestamptz,add column sit_out_hands integer not null default 0 check(sit_out_hands>=0);
create or replace function poker_private.ring_play_meta(p_table uuid) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('context',poker_private.ring_context(p_table),'now',clock_timestamp(),'changedAt',(select c.created_at from poker_private.ring_hand_commits c where c.hand_id=h.id and c.version=h.version),'lastHandId',h.id,'completedAt',h.completed_at,'runoutFrom',h.runout_from,'bankRevision',case when h.bank_revision=h.version then h.bank_revision else null end,'bankUsed',coalesce((select jsonb_object_agg(key,value->>'request') from jsonb_each(h.bank_used)),'{}'::jsonb),
 'penalties',coalesce((select jsonb_object_agg(r.id::text,jsonb_build_object('strikes',r.timeout_streak,'since',r.sit_out_since,'hands',r.sit_out_hands)) from poker_private.ring_fund_reservations r where r.table_id=p_table and r.status='seated'),'{}'::jsonb),'ready',coalesce((select jsonb_agg(r.id) from poker_private.ring_fund_reservations r where r.table_id=p_table and r.status='seated' and r.play_enabled  and r.exit_request is null),'[]'::jsonb))
 from (select 1) stub left join lateral(select * from poker_private.ring_hands where table_id=p_table order by created_at desc,id desc limit 1) h on true;
$$;
create or replace function poker_private.ring_play_ready(p_member uuid,p_reservation uuid) returns void language plpgsql security definer set search_path='' as $$
declare r poker_private.ring_fund_reservations%rowtype;
begin
 select * into r from poker_private.ring_fund_reservations where id=p_reservation;
 if not found or p_member is null or r.member_id<>p_member or not poker_private.ring_member_eligible(p_member) then raise exception 'Seat unavailable';end if;
 perform 1 from public.poker_ring_tables where id=r.table_id for update;
 update poker_private.ring_fund_reservations set timeout_streak=0,sit_out_since=null,sit_out_hands=0,play_enabled=true,present_until=clock_timestamp()+interval '20 seconds' where id=r.id and status='seated' and exit_request is null;
end;$$;
create or replace function poker_private.ring_play_begin(p_table uuid,p_hand uuid,p_roster jsonb,p_terms jsonb,p_sealed jsonb,p_result jsonb) returns bigint language plpgsql security definer set search_path='' as $$begin
 perform 1 from public.poker_ring_tables where id=p_table for update;
 if not exists(select 1 from poker_private.ring_hand_commits where hand_id=p_hand and request_id=p_hand) then
  if exists(select 1 from poker_private.ring_fund_reservations where table_id=p_table and status='seated' and (not play_enabled or exit_request is not null)) then raise exception 'Players not ready';end if;
  if exists(select 1 from poker_private.ring_hands where table_id=p_table and status='complete' and completed_at>clock_timestamp()-interval '6 seconds') then raise exception 'Presentation in progress';end if;
 end if;
 return poker_private.ring_hand_begin(p_table,p_hand,p_roster,p_terms,p_sealed,p_result);
end;$$;
create or replace function poker_private.ring_play_write_v2(p_hand uuid,p_expected bigint,p_write uuid,p_sealed jsonb,p_result jsonb,p_timeout boolean,p_from integer,p_actor uuid) returns bigint language plpgsql security definer set search_path='' as $$
declare tid uuid;changed timestamptz;v bigint;extra interval;actor poker_private.ring_fund_reservations%rowtype;
begin
 select table_id into tid from poker_private.ring_hands where id=p_hand;
 perform 1 from public.poker_ring_tables where id=tid for update;
 if not exists(select 1 from poker_private.ring_hand_commits where hand_id=p_hand and request_id=p_write) then
  select * into actor from poker_private.ring_fund_reservations where id=p_actor and table_id=tid and status='seated' for update;
  if not found or not exists(select 1 from poker_private.ring_hands h,jsonb_array_elements(h.participants) p where h.id=p_hand and (p->>'reservationId')::uuid=p_actor) then raise exception 'Actor unavailable';end if;
  if not p_timeout and actor.sit_out_since is not null then raise exception 'Player sitting out';end if;
  select case when bank_revision=p_expected then interval '20 seconds' else interval '0 seconds' end into extra from poker_private.ring_hands where id=p_hand;
  select created_at into changed from poker_private.ring_hand_commits where hand_id=p_hand and version=p_expected;
  if changed is null or p_timeout is null or (p_timeout and actor.sit_out_since is null and clock_timestamp()<changed+interval '20 seconds'+extra) or (not p_timeout and clock_timestamp()>=changed+interval '20 seconds'+extra) then raise exception 'Turn deadline changed';end if;
  if p_from is null or p_from not in(0,3,4,5) then raise exception 'Invalid board phase';end if;
  v:=poker_private.ring_hand_write(p_hand,p_expected,p_write,p_sealed,p_result);
  update poker_private.ring_fund_reservations set timeout_streak=case when p_timeout then least(3,timeout_streak+1) else 0 end,sit_out_since=case when p_timeout and timeout_streak>=2 then coalesce(sit_out_since,clock_timestamp()) else sit_out_since end where id=p_actor and status='seated';
  if p_result is not null then update poker_private.ring_fund_reservations set sit_out_hands=sit_out_hands+1 where table_id=tid and status='seated' and sit_out_since is not null;end if;
  if p_result is not null then update poker_private.ring_hands set runout_from=p_from where id=p_hand;end if;
 else v:=poker_private.ring_hand_write(p_hand,p_expected,p_write,p_sealed,p_result);
 end if;
 return v;
end;$$;

revoke all on function poker_private.ring_play_write_v2(uuid,bigint,uuid,jsonb,jsonb,boolean,integer,uuid) from public,anon,authenticated;
grant execute on function poker_private.ring_play_write_v2(uuid,bigint,uuid,jsonb,jsonb,boolean,integer,uuid) to service_role;
create function public.poker_ring_play_write_v2(p_hand uuid,p_expected bigint,p_write uuid,p_sealed jsonb,p_result jsonb,p_timeout boolean,p_from integer,p_actor uuid) returns bigint language sql security invoker set search_path='' as $$select poker_private.ring_play_write_v2(p_hand,p_expected,p_write,p_sealed,p_result,p_timeout,p_from,p_actor);$$;
revoke all on function public.poker_ring_play_write_v2(uuid,bigint,uuid,jsonb,jsonb,boolean,integer,uuid) from public,anon,authenticated;
grant execute on function public.poker_ring_play_write_v2(uuid,bigint,uuid,jsonb,jsonb,boolean,integer,uuid) to service_role;
commit;
