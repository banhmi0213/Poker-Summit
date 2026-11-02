-- Prepared only. Frozen SINGLE-TABLE registration plan; no worker/listener starts here.
create table poker_private.registration_finalizations(
 tournament_id uuid primary key references poker_private.registration_policies(tournament_id) on delete restrict,
 room_id uuid not null unique,
 starts_at timestamptz not null check(isfinite(starts_at)),
 structure jsonb not null check(public.valid_poker_structure(structure)),
 members uuid[] not null check(cardinality(members) between 2 and 6),
 capacity smallint not null check(capacity in (2,6)),
 created_at timestamptz not null default clock_timestamp()
);
alter table poker_private.registration_finalizations enable row level security;
revoke all on poker_private.registration_finalizations from public,anon,authenticated;
grant select,insert on poker_private.registration_finalizations to service_role;

-- User-context boolean only. No arbitrary actor UUID, definer privilege or private data.
create function public.poker_registration_manage_allowed(p_tournament uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select coalesce((auth.uid() is not null and not public.is_suspended() and exists(
  select 1 from public.poker_tournaments t where t.id=p_tournament and
   (public.is_admin() or exists(select 1 from public.stores s join public.poker_tournament_store_access a on a.store_id=s.id
     where s.id=t.owner_store_id and s.owner_user_id=auth.uid() and a.enabled)))),false);
$$;
revoke all on function public.poker_registration_manage_allowed(uuid) from public,anon,service_role;
grant execute on function public.poker_registration_manage_allowed(uuid) to authenticated;

create function public.poker_registration_management_status(p_tournament uuid) returns jsonb
language sql volatile security invoker set search_path='' as $$
 select jsonb_build_object('policy',public.poker_registration_status(t.id,null),'enabled',coalesce((select p.enabled from poker_private.registration_policies p where p.tournament_id=t.id),false),
 'finalization',(select jsonb_build_object('roomId',f.room_id,'participants',cardinality(f.members),
  'assigned',exists(select 1 from poker_private.tournament_rooms r where r.room_id=f.room_id))
  from poker_private.registration_finalizations f where f.tournament_id=t.id))
 from public.poker_tournaments t where t.id=p_tournament;
$$;
create function public.poker_registration_freeze(p_tournament uuid,p_expected integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t public.poker_tournaments%rowtype; f poker_private.registration_finalizations%rowtype; ids uuid[];
begin
 if p_expected is null or p_expected not between 2 and 6 then raise exception 'Invalid expected roster'; end if;
 select * into t from public.poker_tournaments where id=p_tournament for update;
 if not found then raise exception 'Tournament unavailable'; end if;
 select * into f from poker_private.registration_finalizations where tournament_id=p_tournament;
 if not found then
  if not t.published or clock_timestamp()>=t.starts_at or not exists(select 1 from poker_private.registration_policies where tournament_id=t.id)
    or exists(select 1 from poker_private.tournament_rooms where tournament_id=t.id) then raise exception 'Finalization unavailable'; end if;
  select array_agg(member_id order by created_at,member_id) into ids from poker_private.tournament_registrations where tournament_id=t.id;
  if coalesce(cardinality(ids),0)<>p_expected then raise exception 'Require 2-6 registered players'; end if;
  insert into poker_private.registration_finalizations(tournament_id,room_id,starts_at,structure,members,capacity)
   values(t.id,gen_random_uuid(),t.starts_at,t.structure,ids,case when cardinality(ids)=2 then 2 else 6 end) returning * into f;
  update poker_private.registration_policies set enabled=false where tournament_id=t.id;
 end if;
 if cardinality(f.members)<>p_expected then raise exception 'Roster count changed'; end if;
 return jsonb_build_object('tournamentId',f.tournament_id,'roomId',f.room_id,'starts_at',f.starts_at,'structure',f.structure,'members',f.members,'capacity',f.capacity,'allowSpectators',false);
end;
$$;
revoke all on function public.poker_registration_management_status(uuid),public.poker_registration_freeze(uuid,integer) from public,anon,authenticated;
grant execute on function public.poker_registration_management_status(uuid),public.poker_registration_freeze(uuid,integer) to service_role;

-- Freeze blocks intake/config changes before encrypted checkpoint provisioning begins.
create or replace function public.poker_registration_status(p_tournament uuid,p_member uuid) returns jsonb
language sql volatile security invoker set search_path='' as $$
 select jsonb_build_object('tournamentId',t.id,'title',t.title,'starts_at',t.starts_at,'capacity',p.capacity,
  'count',(select count(*) from poker_private.tournament_registrations e where e.tournament_id=t.id),
  'registered',exists(select 1 from poker_private.tournament_registrations e where e.tournament_id=t.id and e.member_id=p_member),
  'assigned',exists(select 1 from poker_private.room_admissions a where a.tournament_id=t.id and a.member_id=p_member),
  'registrationOpen',p.enabled and t.published and clock_timestamp()<t.starts_at and not exists(select 1 from poker_private.tournament_rooms r where r.tournament_id=t.id) and not exists(select 1 from poker_private.registration_finalizations f where f.tournament_id=t.id),
  'canCancel',clock_timestamp()<t.starts_at and not exists(select 1 from poker_private.tournament_rooms r where r.tournament_id=t.id) and not exists(select 1 from poker_private.registration_finalizations f where f.tournament_id=t.id)
    and exists(select 1 from poker_private.tournament_registrations e where e.tournament_id=t.id and e.member_id=p_member))
 from public.poker_tournaments t join poker_private.registration_policies p on p.tournament_id=t.id where t.id=p_tournament;
$$;
create or replace function public.poker_registration_configure(p_tournament uuid,p_capacity integer,p_enabled boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t public.poker_tournaments%rowtype; n integer;
begin
 if p_capacity is null or p_capacity not between 2 and 600 or p_enabled is null then raise exception 'Invalid registration policy'; end if;
 select * into t from public.poker_tournaments where id=p_tournament for update;
 if not found or clock_timestamp()>=t.starts_at or exists(select 1 from poker_private.tournament_rooms where tournament_id=p_tournament) or exists(select 1 from poker_private.registration_finalizations where tournament_id=p_tournament) then raise exception 'Registration policy locked'; end if;
 select count(*) into n from poker_private.tournament_registrations where tournament_id=p_tournament;
 if n>p_capacity then raise exception 'Capacity below registrations'; end if;
 insert into poker_private.registration_policies values(p_tournament,p_capacity,p_enabled)
 on conflict(tournament_id) do update set capacity=excluded.capacity,enabled=excluded.enabled;
 return public.poker_registration_status(p_tournament,null);
end;
$$;
create or replace function public.poker_registration_change(p_tournament uuid,p_member uuid,p_action text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t public.poker_tournaments%rowtype; p poker_private.registration_policies%rowtype; present boolean; n integer;
begin
 if p_member is null or p_action is null or p_action not in ('register','cancel') then raise exception 'Invalid registration'; end if;
 -- All configure/register/cancel/provision paths lock the SAME tournament row first.
 select * into t from public.poker_tournaments where id=p_tournament for update;
 if not found then return jsonb_build_object('ok',false,'code','unavailable'); end if;
 select * into p from poker_private.registration_policies where tournament_id=p_tournament;
 if not found then return jsonb_build_object('ok',false,'code','unavailable'); end if;
 select exists(select 1 from poker_private.tournament_registrations where tournament_id=p_tournament and member_id=p_member) into present;
 if not t.published and not present then return jsonb_build_object('ok',false,'code','unavailable'); end if;
 if (p_action='register' and present) or (p_action='cancel' and not present) then
   return jsonb_build_object('ok',true,'state',public.poker_registration_status(p_tournament,p_member)); end if;
 -- Sample AFTER waiting for the row lock: transaction-start now() could admit late users.
 if clock_timestamp()>=t.starts_at or exists(select 1 from poker_private.tournament_rooms where tournament_id=p_tournament) or exists(select 1 from poker_private.registration_finalizations where tournament_id=p_tournament)
   or (p_action='register' and (not p.enabled or not t.published)) then return jsonb_build_object('ok',false,'code','closed'); end if;
 if p_action='register' then
   select count(*) into n from poker_private.tournament_registrations where tournament_id=p_tournament;
   if n>=p.capacity then return jsonb_build_object('ok',false,'code','full'); end if;
   insert into poker_private.tournament_registrations(tournament_id,member_id) values(p_tournament,p_member);
 else delete from poker_private.tournament_registrations where tournament_id=p_tournament and member_id=p_member; end if;
 return jsonb_build_object('ok',true,'state',public.poker_registration_status(p_tournament,p_member));
end;
$$;

-- Legacy rooms without intake retain their original trusted provision path.
create or replace function public.poker_room_provision(p_room uuid,p_tournament uuid,p_members uuid[],p_capacity integer,
 p_spectators boolean,p_starts timestamptz,p_structure jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
declare t public.poker_tournaments%rowtype; r poker_private.tournament_rooms%rowtype; v bigint; existing uuid[]; requested uuid[]; f poker_private.registration_finalizations%rowtype;
begin
 if p_room is null or p_tournament is null or p_capacity is null or p_capacity not in (2,6) or p_spectators is null
    or p_starts is null or p_structure is null or p_members is null or array_ndims(p_members) is distinct from 1
    or cardinality(p_members)<2 or cardinality(p_members)>p_capacity or array_position(p_members,null) is not null
    or (select count(distinct m) from unnest(p_members) m)<>cardinality(p_members) then raise exception 'Invalid room admission'; end if;
 select array_agg(m order by m) into requested from unnest(p_members) m;
 -- Lock tournament first for all provisions: avoids duplicate/moved participant races.
 select * into t from public.poker_tournaments where id=p_tournament for update;
 if not found then raise exception 'Tournament unavailable'; end if;
 select * into f from poker_private.registration_finalizations where tournament_id=p_tournament;
 if exists(select 1 from poker_private.registration_policies where tournament_id=p_tournament) then
  if f.tournament_id is null or f.room_id<>p_room or f.capacity<>p_capacity or p_spectators or f.starts_at<>p_starts or f.structure<>p_structure
    or requested<>(select array_agg(m order by m) from unnest(f.members) m) then raise exception 'Frozen registration roster required'; end if;
 end if;
 select * into r from poker_private.tournament_rooms where room_id=p_room;
 if found then
   select array_agg(member_id order by member_id) into existing from poker_private.room_admissions where room_id=p_room;
   if r.tournament_id=p_tournament and r.capacity=p_capacity and r.allow_spectators=p_spectators
      and r.starts_at=p_starts and r.structure=p_structure and existing=requested then return true; end if;
   raise exception 'Room already provisioned';
 end if;
 if not t.published or t.starts_at<=clock_timestamp() or t.starts_at<>p_starts or t.structure<>p_structure then raise exception 'Tournament changed or registration closed'; end if;
 -- Only the pristine committed empty-room checkpoint can receive its immutable roster.
 select version into v from poker_private.room_checkpoints where room_id=p_room for update;
 if not found or v<>1 then raise exception 'Room is not pristine'; end if;
 if clock_timestamp()>=t.starts_at then raise exception 'Registration closed while awaiting checkpoint'; end if;
 insert into poker_private.tournament_rooms(room_id,tournament_id,starts_at,structure,capacity,allow_spectators,expected_count)
   values(p_room,p_tournament,p_starts,p_structure,p_capacity,p_spectators,cardinality(p_members));
 insert into poker_private.room_admissions(tournament_id,room_id,member_id)
   select p_tournament,p_room,m from unnest(p_members) m;
 return true;
end;
$$;
