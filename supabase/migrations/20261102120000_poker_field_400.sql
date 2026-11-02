-- 1大会400人まで(オーナー 2026/11/02：200人以上きたら回るか)。7人以上は6人卓を最大67卓。
-- 200人まで(20261031190000)と同じ関数・制約を400人に広げたもの。60・100・200人で作った部屋も有効なまま。
alter table poker_private.registration_finalizations drop constraint if exists registration_finalizations_members_check;
alter table poker_private.registration_finalizations add constraint registration_finalizations_members_check check(cardinality(members) between 2 and 400);
alter table poker_private.registration_finalizations drop constraint if exists registration_finalizations_capacity_check;
alter table poker_private.registration_finalizations add constraint registration_finalizations_capacity_check check(capacity in (2,6,60,100,200,400));
alter table poker_private.tournament_rooms drop constraint if exists tournament_rooms_capacity_check;
alter table poker_private.tournament_rooms add constraint tournament_rooms_capacity_check check(capacity in (2,6,60,100,200,400));

-- Manual (open registration) freeze: 2–400 players.
create or replace function public.poker_registration_freeze_legacy(p_tournament uuid,p_expected integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t public.poker_tournaments%rowtype; f poker_private.registration_finalizations%rowtype; ids uuid[];
begin
 if p_expected is null or p_expected not between 2 and 400 then raise exception 'Invalid expected roster'; end if;
 select * into t from public.poker_tournaments where id=p_tournament for update;
 if not found then raise exception 'Tournament unavailable'; end if;
 select * into f from poker_private.registration_finalizations where tournament_id=p_tournament;
 if not found then
  if not t.published or clock_timestamp()>=t.starts_at or not exists(select 1 from poker_private.registration_policies where tournament_id=t.id)
    or exists(select 1 from poker_private.tournament_rooms where tournament_id=t.id) then raise exception 'Finalization unavailable'; end if;
  select array_agg(member_id order by created_at,member_id) into ids from poker_private.tournament_registrations where tournament_id=t.id;
  if coalesce(cardinality(ids),0)<>p_expected then raise exception 'Require 2-400 registered players'; end if;
  insert into poker_private.registration_finalizations(tournament_id,room_id,starts_at,structure,members,capacity)
   values(t.id,gen_random_uuid(),t.starts_at,t.structure,ids,case when cardinality(ids)=2 then 2 when cardinality(ids)<=6 then 6 else 400 end) returning * into f;
  update poker_private.registration_policies set enabled=false where tournament_id=t.id;
 end if;
 if cardinality(f.members)<>p_expected then raise exception 'Roster count changed'; end if;
 return jsonb_build_object('tournamentId',f.tournament_id,'roomId',f.room_id,'starts_at',f.starts_at,'structure',f.structure,'members',f.members,'capacity',f.capacity,'allowSpectators',false);
end;
$$;

-- Trusted provision accepts the multi-table capacity.
create or replace function public.poker_room_provision(p_room uuid,p_tournament uuid,p_members uuid[],p_capacity integer,
 p_spectators boolean,p_starts timestamptz,p_structure jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
declare t public.poker_tournaments%rowtype; r poker_private.tournament_rooms%rowtype; v bigint; existing uuid[]; requested uuid[]; f poker_private.registration_finalizations%rowtype;
begin
 if p_room is null or p_tournament is null or p_capacity is null or p_capacity not in (2,6,60,100,200,400) or p_spectators is null
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

-- Open-registration tournaments also close and get their tables automatically 10 minutes before the start
-- (no organizer action needed); a frozen plan whose room is not bound yet is retried with the same roster.
create or replace function public.poker_entry_due() returns jsonb language sql volatile security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('tournamentId',d.id,'count',d.n)),'[]'::jsonb) from (
  select t.id,(select count(*) from poker_private.entry_targets where tournament_id=t.id)::integer n,t.starts_at
   from public.poker_tournaments t join poker_private.entry_settings s on s.tournament_id=t.id join poker_private.registration_policies p on p.tournament_id=t.id
   where s.automatic and p.enabled and t.published and clock_timestamp()>=t.starts_at-interval '10 minutes' and clock_timestamp()<t.starts_at
    and not exists(select 1 from poker_private.tournament_rooms where tournament_id=t.id)
  union all
  select t.id,coalesce((select cardinality(f.members) from poker_private.registration_finalizations f where f.tournament_id=t.id),(select count(*) from poker_private.tournament_registrations r where r.tournament_id=t.id))::integer,t.starts_at
   from public.poker_tournaments t join poker_private.registration_policies p on p.tournament_id=t.id
   where not exists(select 1 from poker_private.entry_settings s where s.tournament_id=t.id and s.automatic)
    and t.published and clock_timestamp()>=t.starts_at-interval '10 minutes' and clock_timestamp()<t.starts_at
    and not exists(select 1 from poker_private.tournament_rooms where tournament_id=t.id)
    and (p.enabled or exists(select 1 from poker_private.registration_finalizations f where f.tournament_id=t.id))
  order by starts_at limit 128) d where d.n between 2 and 400;
$$;
revoke all on function public.poker_entry_due() from public,anon,authenticated;
grant execute on function public.poker_entry_due() to service_role;
