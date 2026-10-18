-- Prepared only. Conservative backfill blocks partial legacy rosters until reconciled.
alter table poker_private.tournament_rooms add column expected_count smallint;
update poker_private.tournament_rooms set expected_count=capacity;
alter table poker_private.tournament_rooms alter column expected_count set not null;
alter table poker_private.tournament_rooms add check(expected_count between 2 and capacity);
create or replace function public.poker_room_provision(p_room uuid,p_tournament uuid,p_members uuid[],p_capacity integer,
 p_spectators boolean,p_starts timestamptz,p_structure jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
declare t public.poker_tournaments%rowtype; r poker_private.tournament_rooms%rowtype; v bigint; existing uuid[]; requested uuid[];
begin
 if p_room is null or p_tournament is null or p_capacity is null or p_capacity not in (2,6) or p_spectators is null
    or p_starts is null or p_structure is null or p_members is null or array_ndims(p_members) is distinct from 1
    or cardinality(p_members)<2 or cardinality(p_members)>p_capacity or array_position(p_members,null) is not null
    or (select count(distinct m) from unnest(p_members) m)<>cardinality(p_members) then raise exception 'Invalid room admission'; end if;
 select array_agg(m order by m) into requested from unnest(p_members) m;
 -- Lock tournament first for all provisions: avoids duplicate/moved participant races.
 select * into t from public.poker_tournaments where id=p_tournament for update;
 if not found then raise exception 'Tournament unavailable'; end if;
 select * into r from poker_private.tournament_rooms where room_id=p_room;
 if found then
   select array_agg(member_id order by member_id) into existing from poker_private.room_admissions where room_id=p_room;
   if r.tournament_id=p_tournament and r.capacity=p_capacity and r.allow_spectators=p_spectators
      and r.starts_at=p_starts and r.structure=p_structure and existing=requested then return true; end if;
   raise exception 'Room already provisioned';
 end if;
 if not t.published or t.starts_at<=now() or t.starts_at<>p_starts or t.structure<>p_structure then raise exception 'Tournament changed or registration closed'; end if;
 -- Only the pristine committed empty-room checkpoint can receive its immutable roster.
 select version into v from poker_private.room_checkpoints where room_id=p_room for update;
 if not found or v<>1 then raise exception 'Room is not pristine'; end if;
 insert into poker_private.tournament_rooms(room_id,tournament_id,starts_at,structure,capacity,allow_spectators,expected_count)
   values(p_room,p_tournament,p_starts,p_structure,p_capacity,p_spectators,cardinality(p_members));
 insert into poker_private.room_admissions(tournament_id,room_id,member_id)
   select p_tournament,p_room,m from unnest(p_members) m;
 return true;
end;
$$;

create function public.poker_room_control(p_room uuid) returns jsonb
language sql security invoker set search_path='' as $$
 select jsonb_build_object('roomId',r.room_id,'enabled',r.enabled,'published',t.published,
  'expectedCount',r.expected_count,'members',coalesce((select jsonb_agg(a.member_id order by a.member_id)
     from poker_private.room_admissions a where a.room_id=r.room_id),'[]'::jsonb))
 from poker_private.tournament_rooms r join public.poker_tournaments t on t.id=r.tournament_id
 where r.room_id=p_room;
$$;
revoke all on function public.poker_room_control(uuid) from public,anon,authenticated;
grant execute on function public.poker_room_control(uuid) to service_role;
-- CREATE OR REPLACE preserves the provision RPC's existing backend-only ACL.
