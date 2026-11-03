-- Prepared only. Backend-owned admission/directory; no browser table or RPC access.
create table poker_private.tournament_rooms (
 room_id uuid primary key references poker_private.room_checkpoints(room_id),
 tournament_id uuid not null references public.poker_tournaments(id) on delete restrict,
 starts_at timestamptz not null check(isfinite(starts_at)),
 structure jsonb not null check(public.valid_poker_structure(structure)),
 capacity smallint not null check(capacity in (2,6)),
 allow_spectators boolean not null default false,
 enabled boolean not null default true,
 unique(room_id,tournament_id)
);
create index tournament_rooms_tournament on poker_private.tournament_rooms(tournament_id);
create table poker_private.room_admissions (
 tournament_id uuid not null,
 room_id uuid not null,
 member_id uuid not null references auth.users(id) on delete cascade,
 primary key(tournament_id,member_id),
 foreign key(room_id,tournament_id) references poker_private.tournament_rooms(room_id,tournament_id) on delete restrict
);
create index room_admissions_room on poker_private.room_admissions(room_id,tournament_id);
alter table poker_private.tournament_rooms enable row level security;
alter table poker_private.room_admissions enable row level security;
revoke all on poker_private.tournament_rooms,poker_private.room_admissions from public,anon,authenticated;
grant select,insert on poker_private.tournament_rooms,poker_private.room_admissions to service_role;
-- Operational disable/revocation is a trusted direct DB/maintenance operation, not a player RPC.

create function public.poker_room_tournament_config(p_tournament uuid) returns jsonb
language sql security invoker set search_path='' as $$
 select jsonb_build_object('tournamentId',id,'starts_at',starts_at,'structure',structure)
 from public.poker_tournaments where id=p_tournament and published and starts_at>now();
$$;
create function public.poker_room_binding(p_room uuid) returns jsonb
language sql security invoker set search_path='' as $$
 select jsonb_build_object('roomId',room_id,'tournamentId',tournament_id,'starts_at',starts_at,
  'structure',structure,'capacity',capacity,'allowSpectators',allow_spectators,'enabled',enabled)
 from poker_private.tournament_rooms where room_id=p_room;
$$;
create function public.poker_room_authorize(p_room uuid,p_member uuid,p_operation text) returns boolean
language sql security invoker set search_path='' as $$
 select coalesce((select r.enabled and
   case when p_operation='spectate' then
      exists(select 1 from poker_private.room_admissions a where a.room_id=r.room_id and a.member_id=p_member)
      or (t.published and r.allow_spectators)
   when p_operation in ('seat','connect','state','act','disconnect','leave') then
      (p_operation<>'seat' or t.published) and
      exists(select 1 from poker_private.room_admissions a where a.room_id=r.room_id and a.member_id=p_member)
   else false end
 from poker_private.tournament_rooms r join public.poker_tournaments t on t.id=r.tournament_id
 where r.room_id=p_room and p_member is not null),false);
$$;

create function public.poker_room_provision(p_room uuid,p_tournament uuid,p_members uuid[],p_capacity integer,
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
 insert into poker_private.tournament_rooms(room_id,tournament_id,starts_at,structure,capacity,allow_spectators)
   values(p_room,p_tournament,p_starts,p_structure,p_capacity,p_spectators);
 insert into poker_private.room_admissions(tournament_id,room_id,member_id)
   select p_tournament,p_room,m from unnest(p_members) m;
 return true;
end;
$$;
revoke all on function public.poker_room_tournament_config(uuid),public.poker_room_binding(uuid),
 public.poker_room_authorize(uuid,uuid,text),public.poker_room_provision(uuid,uuid,uuid[],integer,boolean,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.poker_room_tournament_config(uuid),public.poker_room_binding(uuid),
 public.poker_room_authorize(uuid,uuid,text),public.poker_room_provision(uuid,uuid,uuid[],integer,boolean,timestamptz,jsonb) to service_role;
-- The existing public table's data/API grants do not automatically grant its use to this role.
grant select,update(id) on public.poker_tournaments to service_role;
