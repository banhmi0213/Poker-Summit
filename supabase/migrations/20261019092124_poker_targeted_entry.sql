-- Email is a manager lookup only. Target identity is the immutable Auth UUID.
create table poker_private.entry_targets(tournament_id uuid not null references public.poker_tournaments(id) on delete cascade,member_id uuid not null references auth.users(id) on delete restrict,primary key(tournament_id,member_id));
create table poker_private.entry_settings(tournament_id uuid primary key references public.poker_tournaments(id) on delete cascade,automatic boolean not null default false);
alter table poker_private.entry_targets enable row level security;
alter table poker_private.entry_settings enable row level security;
revoke all on poker_private.entry_targets,poker_private.entry_settings from public,anon,authenticated;
grant select on poker_private.entry_targets,poker_private.entry_settings to service_role;
create function poker_private.entry_eligible(tid uuid,mid uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select mid is not null and (not exists(select 1 from poker_private.entry_settings where tournament_id=tid and automatic) or exists(select 1 from poker_private.entry_targets where tournament_id=tid and member_id=mid));
$$;
revoke all on function poker_private.entry_eligible(uuid,uuid) from public,anon,authenticated;
grant execute on function poker_private.entry_eligible(uuid,uuid) to service_role;
create function poker_private.manage_entry(tid uuid,emails text[] default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.poker_tournaments%rowtype; ids uuid[]; result jsonb;
begin
 if auth.uid() is null or coalesce(public.is_suspended(),true) or not public.poker_registration_manage_allowed(tid) then raise exception 'Not authorized'; end if;
 select * into t from public.poker_tournaments where id=tid for update;
 if not found or not public.poker_registration_manage_allowed(tid) then raise exception 'Not authorized'; end if;
 if emails is not null then
  if clock_timestamp()>=t.starts_at-interval '10 minutes' or exists(select 1 from poker_private.registration_finalizations where tournament_id=tid) or exists(select 1 from poker_private.tournament_rooms where tournament_id=tid) then raise exception 'Entry settings locked'; end if;
  if cardinality(emails) not between 2 and 6 or array_ndims(emails)<>1 or array_position(emails,null) is not null or (select count(distinct lower(trim(e))) from unnest(emails) e)<>cardinality(emails) then raise exception 'Require 2-6 unique verified members'; end if;
  select array_agg(u.id order by u.id) into ids from auth.users u where lower(u.email) in(select lower(trim(e)) from unnest(emails) e) and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=clock_timestamp());
  if coalesce(cardinality(ids),0)<>cardinality(emails) then raise exception 'One or more verified members not found'; end if;
  if exists(select 1 from poker_private.tournament_registrations r where r.tournament_id=tid and not(r.member_id=any(ids))) then raise exception 'Registered member would be removed'; end if;
  delete from poker_private.entry_targets where tournament_id=tid;
  insert into poker_private.entry_targets select tid,unnest(ids);
  insert into poker_private.entry_settings values(tid,true) on conflict(tournament_id) do update set automatic=true;
  insert into poker_private.registration_policies values(tid,cardinality(ids),true) on conflict(tournament_id) do update set capacity=excluded.capacity,enabled=true;
 end if;
 select jsonb_build_object('automatic',coalesce((select automatic from poker_private.entry_settings where tournament_id=tid),false),'locked',clock_timestamp()>=t.starts_at-interval '10 minutes' or exists(select 1 from poker_private.registration_finalizations where tournament_id=tid),
 'members',coalesce((select jsonb_agg(jsonb_build_object('email',u.email,'name',left(coalesce(u.raw_user_meta_data->>'display_name','会員'),80)) order by lower(u.email)) from poker_private.entry_targets e join auth.users u on u.id=e.member_id where e.tournament_id=tid),'[]'::jsonb)) into result;
 return result;
end;
$$;
revoke all on function poker_private.manage_entry(uuid,text[]) from public,anon;
grant usage on schema poker_private to authenticated;
grant execute on function poker_private.manage_entry(uuid,text[]) to authenticated;
create function public.poker_entry_manage(p_tournament uuid,p_emails text[] default null) returns jsonb language sql security invoker set search_path='' as $$select poker_private.manage_entry(p_tournament,p_emails);$$;
revoke all on function public.poker_entry_manage(uuid,text[]) from public,anon;
grant execute on function public.poker_entry_manage(uuid,text[]) to authenticated;
alter function public.poker_registration_status(uuid,uuid) rename to poker_registration_status_legacy;
create function public.poker_registration_status(p_tournament uuid,p_member uuid) returns jsonb language sql volatile security invoker set search_path='' as $$
 select case when coalesce(s.automatic,false) then jsonb_build_object('tournamentId',t.id,'title',t.title,'starts_at',t.starts_at,'capacity',p.capacity,'count',(select count(*) from poker_private.tournament_registrations where tournament_id=t.id),
 'registered',exists(select 1 from poker_private.tournament_registrations where tournament_id=t.id and member_id=p_member),
 'assigned',exists(select 1 from poker_private.room_admissions a join poker_private.tournament_registrations e on e.tournament_id=a.tournament_id and e.member_id=a.member_id where a.tournament_id=t.id and a.member_id=p_member),
 'registrationOpen',p.enabled and t.published and clock_timestamp()<t.starts_at and poker_private.entry_eligible(t.id,p_member),
 'canCancel',clock_timestamp()<t.starts_at and exists(select 1 from poker_private.tournament_registrations where tournament_id=t.id and member_id=p_member),'eligible',poker_private.entry_eligible(t.id,p_member),'automatic',true)
 else public.poker_registration_status_legacy(p_tournament,p_member)||jsonb_build_object('eligible',true,'automatic',false) end
 from public.poker_tournaments t join poker_private.registration_policies p on p.tournament_id=t.id left join poker_private.entry_settings s on s.tournament_id=t.id where t.id=p_tournament;
$$;
alter function public.poker_registration_change(uuid,uuid,text) rename to poker_registration_change_legacy;
create function public.poker_registration_change(p_tournament uuid,p_member uuid,p_action text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.poker_tournaments%rowtype; p poker_private.registration_policies%rowtype;
begin
 if not exists(select 1 from poker_private.entry_settings where tournament_id=p_tournament and automatic) then return public.poker_registration_change_legacy(p_tournament,p_member,p_action); end if;
 select * into t from public.poker_tournaments where id=p_tournament for update;
 if not found or not poker_private.entry_eligible(p_tournament,p_member) then return jsonb_build_object('ok',false,'code','unavailable'); end if;
 select * into p from poker_private.registration_policies where tournament_id=p_tournament;
 if p_action is null or p_action not in ('register','cancel') or clock_timestamp()>=t.starts_at or not t.published or not coalesce(p.enabled,false) then return jsonb_build_object('ok',false,'code','closed'); end if;
 if p_action='register' then insert into poker_private.tournament_registrations(tournament_id,member_id) values(p_tournament,p_member) on conflict do nothing;
 else delete from poker_private.tournament_registrations where tournament_id=p_tournament and member_id=p_member; end if;
 return jsonb_build_object('ok',true,'state',public.poker_registration_status(p_tournament,p_member));
end;
$$;
alter function public.poker_registration_freeze(uuid,integer) rename to poker_registration_freeze_legacy;
create function public.poker_registration_freeze(p_tournament uuid,p_expected integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.poker_tournaments%rowtype; f poker_private.registration_finalizations%rowtype; ids uuid[];
begin
 if not exists(select 1 from poker_private.entry_settings where tournament_id=p_tournament and automatic) then return public.poker_registration_freeze_legacy(p_tournament,p_expected); end if;
 select * into t from public.poker_tournaments where id=p_tournament for update;
 if not found or not t.published or clock_timestamp()<t.starts_at-interval '10 minutes' or clock_timestamp()>=t.starts_at then raise exception 'Outside seating window'; end if;
 select * into f from poker_private.registration_finalizations where tournament_id=p_tournament;
 if not found then
  select array_agg(member_id order by member_id) into ids from poker_private.entry_targets where tournament_id=p_tournament;
  if cardinality(ids) is null or cardinality(ids) not between 2 and 6 or cardinality(ids)<>p_expected then raise exception 'Invalid target count'; end if;
  insert into poker_private.registration_finalizations(tournament_id,room_id,starts_at,structure,members,capacity) values(t.id,gen_random_uuid(),t.starts_at,t.structure,ids,case when cardinality(ids)=2 then 2 else 6 end) returning * into f;
 end if;
 if cardinality(f.members)<>p_expected then raise exception 'Target count changed'; end if;
 return jsonb_build_object('tournamentId',f.tournament_id,'roomId',f.room_id,'starts_at',f.starts_at,'structure',f.structure,'members',f.members,'capacity',f.capacity,'allowSpectators',false);
end;
$$;
alter function public.poker_room_authorize(uuid,uuid,text) rename to poker_room_authorize_legacy;
create function public.poker_room_authorize(p_room uuid,p_member uuid,p_operation text) returns boolean language sql volatile security invoker set search_path='' as $$
 select public.poker_room_authorize_legacy(p_room,p_member,p_operation) and coalesce((select case when s.automatic then clock_timestamp()>=r.starts_at-interval '10 minutes' and poker_private.entry_eligible(r.tournament_id,p_member) and exists(select 1 from poker_private.tournament_registrations where tournament_id=r.tournament_id and member_id=p_member) else true end from poker_private.tournament_rooms r left join poker_private.entry_settings s on s.tournament_id=r.tournament_id where r.room_id=p_room),false);
$$;
alter function public.poker_room_assignments(uuid) rename to poker_room_assignments_legacy;
create function public.poker_room_assignments(p_member uuid) returns jsonb language sql volatile security invoker set search_path='' as $$
 select coalesce(jsonb_agg(v),'[]'::jsonb) from jsonb_array_elements(public.poker_room_assignments_legacy(p_member)) v where not exists(select 1 from poker_private.entry_settings where tournament_id=(v->>'tournamentId')::uuid and automatic) or (exists(select 1 from poker_private.tournament_registrations where tournament_id=(v->>'tournamentId')::uuid and member_id=p_member) and clock_timestamp()>=(v->>'starts_at')::timestamptz-interval '10 minutes');
$$;
alter function public.poker_room_control(uuid) rename to poker_room_control_legacy;
create function public.poker_room_control(p_room uuid) returns jsonb language sql volatile security invoker set search_path='' as $$
 select case when coalesce(s.automatic,false) then public.poker_room_control_legacy(p_room)||jsonb_build_object('seatedStart',true,'members',coalesce((select jsonb_agg(a.member_id order by a.member_id) from poker_private.room_admissions a join poker_private.tournament_registrations e on e.tournament_id=a.tournament_id and e.member_id=a.member_id where a.room_id=p_room),'[]'::jsonb)) else public.poker_room_control_legacy(p_room) end from poker_private.tournament_rooms r left join poker_private.entry_settings s on s.tournament_id=r.tournament_id where r.room_id=p_room;
$$;
create function public.poker_entry_due() returns jsonb language sql volatile security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('tournamentId',t.id,'count',(select count(*) from poker_private.entry_targets where tournament_id=t.id))),'[]'::jsonb) from (select t.id from public.poker_tournaments t join poker_private.entry_settings s on s.tournament_id=t.id join poker_private.registration_policies p on p.tournament_id=t.id where s.automatic and p.enabled and t.published and clock_timestamp()>=t.starts_at-interval '10 minutes' and clock_timestamp()<t.starts_at and not exists(select 1 from poker_private.tournament_rooms where tournament_id=t.id) order by t.starts_at limit 128) t;
$$;
-- Trigger-only guard; public table RLS still authorizes every write.
create function poker_private.guard_entry_schedule() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.starts_at is distinct from old.starts_at or new.structure is distinct from old.structure or new.owner_store_id is distinct from old.owner_store_id) and exists(select 1 from poker_private.entry_settings where tournament_id=old.id and automatic) and (clock_timestamp()>=old.starts_at-interval '10 minutes' or exists(select 1 from poker_private.registration_finalizations where tournament_id=old.id)) then raise exception 'Automatic tournament schedule is locked'; end if;
 return new;
end;
$$;
revoke all on function poker_private.guard_entry_schedule() from public,anon,authenticated,service_role;
create trigger poker_entry_schedule_guard before update on public.poker_tournaments for each row execute function poker_private.guard_entry_schedule();
revoke all on function public.poker_registration_status(uuid,uuid) from public,anon,authenticated;
grant execute on function public.poker_registration_status(uuid,uuid) to service_role;
revoke all on function public.poker_registration_change(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.poker_registration_change(uuid,uuid,text) to service_role;
revoke all on function public.poker_registration_freeze(uuid,integer) from public,anon,authenticated;
grant execute on function public.poker_registration_freeze(uuid,integer) to service_role;
revoke all on function public.poker_room_authorize(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.poker_room_authorize(uuid,uuid,text) to service_role;
revoke all on function public.poker_room_assignments(uuid) from public,anon,authenticated;
grant execute on function public.poker_room_assignments(uuid) to service_role;
revoke all on function public.poker_room_control(uuid) from public,anon,authenticated;
grant execute on function public.poker_room_control(uuid) to service_role;
revoke all on function public.poker_entry_due() from public,anon,authenticated;
grant execute on function public.poker_entry_due() to service_role;

