-- Prepared only. Free registration intake, separate from immutable room admissions/chips.
create table poker_private.registration_policies(
 tournament_id uuid primary key references public.poker_tournaments(id) on delete cascade,
 capacity integer not null check(capacity between 2 and 600),
 enabled boolean not null default false
);
create table poker_private.tournament_registrations(
 tournament_id uuid not null references poker_private.registration_policies(tournament_id) on delete cascade,
 member_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default clock_timestamp(),
 primary key(tournament_id,member_id)
);
create index tournament_registrations_member on poker_private.tournament_registrations(member_id,tournament_id);
alter table poker_private.registration_policies enable row level security;
alter table poker_private.tournament_registrations enable row level security;
revoke all on poker_private.registration_policies,poker_private.tournament_registrations from public,anon,authenticated;
grant select,insert,update on poker_private.registration_policies to service_role;
grant select,insert,delete on poker_private.tournament_registrations to service_role;

create function public.poker_registration_status(p_tournament uuid,p_member uuid) returns jsonb
language sql volatile security invoker set search_path='' as $$
 select jsonb_build_object('tournamentId',t.id,'title',t.title,'starts_at',t.starts_at,'capacity',p.capacity,
  'count',(select count(*) from poker_private.tournament_registrations e where e.tournament_id=t.id),
  'registered',exists(select 1 from poker_private.tournament_registrations e where e.tournament_id=t.id and e.member_id=p_member),
  'assigned',exists(select 1 from poker_private.room_admissions a where a.tournament_id=t.id and a.member_id=p_member),
  'registrationOpen',p.enabled and t.published and clock_timestamp()<t.starts_at and not exists(select 1 from poker_private.tournament_rooms r where r.tournament_id=t.id),
  'canCancel',clock_timestamp()<t.starts_at and not exists(select 1 from poker_private.tournament_rooms r where r.tournament_id=t.id)
    and exists(select 1 from poker_private.tournament_registrations e where e.tournament_id=t.id and e.member_id=p_member))
 from public.poker_tournaments t join poker_private.registration_policies p on p.tournament_id=t.id where t.id=p_tournament;
$$;
create function public.poker_registration_configure(p_tournament uuid,p_capacity integer,p_enabled boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t public.poker_tournaments%rowtype; n integer;
begin
 if p_capacity is null or p_capacity not between 2 and 600 or p_enabled is null then raise exception 'Invalid registration policy'; end if;
 select * into t from public.poker_tournaments where id=p_tournament for update;
 if not found or clock_timestamp()>=t.starts_at or exists(select 1 from poker_private.tournament_rooms where tournament_id=p_tournament) then raise exception 'Registration policy locked'; end if;
 select count(*) into n from poker_private.tournament_registrations where tournament_id=p_tournament;
 if n>p_capacity then raise exception 'Capacity below registrations'; end if;
 insert into poker_private.registration_policies values(p_tournament,p_capacity,p_enabled)
 on conflict(tournament_id) do update set capacity=excluded.capacity,enabled=excluded.enabled;
 return public.poker_registration_status(p_tournament,null);
end;
$$;
create function public.poker_registration_catalog(p_member uuid) returns jsonb
language sql volatile security invoker set search_path='' as $$
 select coalesce(jsonb_agg(public.poker_registration_status(t.id,p_member) order by t.starts_at,t.id),'[]'::jsonb)
 from (select t.id,t.starts_at from public.poker_tournaments t join poker_private.registration_policies p on p.tournament_id=t.id
  where (t.published and t.starts_at>clock_timestamp()) or exists(select 1 from poker_private.tournament_registrations e where e.tournament_id=t.id and e.member_id=p_member)
  order by t.starts_at,t.id limit 65) t;
$$;
create function public.poker_registration_change(p_tournament uuid,p_member uuid,p_action text) returns jsonb
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
 if clock_timestamp()>=t.starts_at or exists(select 1 from poker_private.tournament_rooms where tournament_id=p_tournament)
   or (p_action='register' and (not p.enabled or not t.published)) then return jsonb_build_object('ok',false,'code','closed'); end if;
 if p_action='register' then
   select count(*) into n from poker_private.tournament_registrations where tournament_id=p_tournament;
   if n>=p.capacity then return jsonb_build_object('ok',false,'code','full'); end if;
   insert into poker_private.tournament_registrations(tournament_id,member_id) values(p_tournament,p_member);
 else delete from poker_private.tournament_registrations where tournament_id=p_tournament and member_id=p_member; end if;
 return jsonb_build_object('ok',true,'state',public.poker_registration_status(p_tournament,p_member));
end;
$$;
revoke all on function public.poker_registration_status(uuid,uuid),public.poker_registration_configure(uuid,integer,boolean),
 public.poker_registration_catalog(uuid),public.poker_registration_change(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.poker_registration_status(uuid,uuid),public.poker_registration_configure(uuid,integer,boolean),
 public.poker_registration_catalog(uuid),public.poker_registration_change(uuid,uuid,text) to service_role;
