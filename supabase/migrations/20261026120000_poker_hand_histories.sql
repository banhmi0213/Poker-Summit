-- Hand histories (2026/10/26): one readable record per settled ring/tournament hand.
-- The record holds EVERY player's hole cards. Operators may see them all (fraud checks);
-- members see only their own cards and cards shown at showdown, through the read RPCs below.
create table if not exists poker_private.hand_histories(
 hand_id uuid primary key,
 kind text not null check(kind in('ring','tournament')),
 source_id uuid not null,
 hand_number integer check(hand_number is null or hand_number>=0),
 played_at timestamptz not null default now(),
 record jsonb not null check(jsonb_typeof(record)='object' and length(record::text)<=200000)
);
create table if not exists poker_private.hand_history_members(
 hand_id uuid not null references poker_private.hand_histories(hand_id),
 member_id uuid not null,
 seat_id text not null check(seat_id ~ '^seat-[1-6]$'),
 net bigint not null,
 played_at timestamptz not null,
 primary key(hand_id,member_id)
);
create index if not exists hand_history_members_member_played on poker_private.hand_history_members(member_id,played_at desc);
create index if not exists hand_histories_played on poker_private.hand_histories(played_at desc);
alter table poker_private.hand_histories enable row level security;
alter table poker_private.hand_history_members enable row level security;
revoke all on poker_private.hand_histories,poker_private.hand_history_members from public,anon,authenticated;
grant select,insert on poker_private.hand_histories,poker_private.hand_history_members to service_role;

-- Server-owned write path only (game server, service role). Idempotent per hand.
create or replace function public.poker_hand_history_save(p_hand uuid,p_kind text,p_source uuid,p_hand_number integer,p_record jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare inserted uuid;
begin
 if p_hand is null or p_source is null or p_kind is null or p_kind not in('ring','tournament')
    or p_record is null or jsonb_typeof(p_record)<>'object' or length(p_record::text)>200000
    or p_record->>'version' is distinct from '1' or p_record->>'handId' is distinct from p_hand::text
    or jsonb_typeof(p_record->'players') is distinct from 'array'
    or jsonb_array_length(p_record->'players') not between 2 and 6
    or jsonb_typeof(p_record->'actions') is distinct from 'array'
    or exists(select 1 from jsonb_array_elements(p_record->'players') p
      where coalesce(p->>'seatId','') !~ '^seat-[1-6]$'
         or coalesce(p->>'memberId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         or jsonb_typeof(p->'net') is distinct from 'number'
         or jsonb_typeof(p->'hole') is distinct from 'array')
    or (select count(distinct p->>'memberId') from jsonb_array_elements(p_record->'players') p)<>jsonb_array_length(p_record->'players')
    or (select count(distinct p->>'seatId') from jsonb_array_elements(p_record->'players') p)<>jsonb_array_length(p_record->'players') then
   raise exception 'Invalid hand history';
 end if;
 insert into poker_private.hand_histories(hand_id,kind,source_id,hand_number,record)
   values(p_hand,p_kind,p_source,p_hand_number,p_record) on conflict(hand_id) do nothing returning hand_id into inserted;
 if inserted is null then return false; end if;
 insert into poker_private.hand_history_members(hand_id,member_id,seat_id,net,played_at)
   select p_hand,(p->>'memberId')::uuid,p->>'seatId',(p->>'net')::bigint,h.played_at
   from jsonb_array_elements(p_record->'players') p cross join poker_private.hand_histories h where h.hand_id=p_hand;
 return true;
end;
$$;
revoke all on function public.poker_hand_history_save(uuid,text,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.poker_hand_history_save(uuid,text,uuid,integer,jsonb) to service_role;

-- Display title for a hand: ring table title or tournament title.
create or replace function poker_private.hand_history_title(p_kind text,p_source uuid) returns text
language sql stable security definer set search_path='' as $$
 select case when p_kind='ring' then (select t.title from public.poker_ring_tables t where t.id=p_source)
  else (select t.title from poker_private.tournament_rooms r join public.poker_tournaments t on t.id=r.tournament_id where r.room_id=p_source) end;
$$;
revoke all on function poker_private.hand_history_title(text,uuid) from public,anon,authenticated;

-- Member-safe projection. Caller identity is never a parameter.
create or replace function poker_private.hand_history_view(h poker_private.hand_histories,who uuid,p_admin boolean) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'handId',h.hand_id,'kind',h.kind,'title',poker_private.hand_history_title(h.kind,h.source_id),
  'handNumber',h.hand_number,'playedAt',h.played_at,'terms',h.record->'terms','buttonSeatId',h.record->'buttonSeatId',
  'board',h.record->'board','actions',h.record->'actions','result',h.record->'result',
  'players',(select jsonb_agg(
     jsonb_build_object('seatId',p->>'seatId','seat',(p->>'seat')::integer,'position',p->>'position',
      'name',coalesce(nullif(u.raw_user_meta_data->>'display_name',''),'会員'),
      'startStack',p->'startStack','endStack',p->'endStack','net',p->'net','folded',p->'folded','shown',p->'shown',
      'you',(p->>'memberId')=who::text,
      'hole',case when p_admin or (p->>'memberId')=who::text or (p->>'shown')::boolean then p->'hole' else null end)
     ||case when p_admin then jsonb_build_object('memberId',p->>'memberId') else '{}'::jsonb end
     order by (p->>'seat')::integer)
   from jsonb_array_elements(h.record->'players') p left join auth.users u on u.id::text=p->>'memberId'));
$$;
revoke all on function poker_private.hand_history_view(poker_private.hand_histories,uuid,boolean) from public,anon,authenticated;

create or replace function public.poker_hand_history_list(p_admin boolean default false,p_before timestamptz default null,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=auth.uid(); lim integer:=least(greatest(coalesce(p_limit,20),1),100);
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required'; end if;
 if p_admin and not coalesce(public.is_admin(),false) then raise exception 'Admin required'; end if;
 return coalesce((select jsonb_agg(poker_private.hand_history_view(h,who,p_admin) order by h.played_at desc,h.hand_id)
  from (select h.* from poker_private.hand_histories h
        where (p_admin or exists(select 1 from poker_private.hand_history_members m where m.hand_id=h.hand_id and m.member_id=who))
          and (p_before is null or h.played_at<p_before)
        order by h.played_at desc,h.hand_id limit lim) h),'[]'::jsonb);
end;
$$;
revoke all on function public.poker_hand_history_list(boolean,timestamptz,integer) from public,anon;
grant execute on function public.poker_hand_history_list(boolean,timestamptz,integer) to authenticated;

create or replace function public.poker_hand_history_detail(p_hand uuid,p_admin boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=auth.uid(); h poker_private.hand_histories;
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required'; end if;
 if p_admin and not coalesce(public.is_admin(),false) then raise exception 'Admin required'; end if;
 select * into h from poker_private.hand_histories where hand_id=p_hand;
 if not found or not (p_admin or exists(select 1 from poker_private.hand_history_members m where m.hand_id=p_hand and m.member_id=who)) then return null; end if;
 return poker_private.hand_history_view(h,who,p_admin);
end;
$$;
revoke all on function public.poker_hand_history_detail(uuid,boolean) from public,anon;
grant execute on function public.poker_hand_history_detail(uuid,boolean) to authenticated;
