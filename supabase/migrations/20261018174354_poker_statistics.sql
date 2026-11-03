-- Result archive is independent of live room lifetime. No client may submit results.
create table poker_private.tournament_finishes(
 tournament_id uuid primary key references public.poker_tournaments(id) on delete restrict,
 room_id uuid not null unique references poker_private.tournament_rooms(room_id),
 hand_id uuid not null,
 finished_at timestamptz not null,
 standings jsonb not null check(jsonb_typeof(standings)='array')
);
create table poker_private.ring_accounts(
 member_id uuid primary key references auth.users(id) on delete restrict,
 available bigint not null default 0 check(available between 0 and 4503599627370495),
 in_play bigint not null default 0 check(in_play between 0 and 4503599627370495),
 updated_at timestamptz not null default now()
);
alter table poker_private.tournament_finishes enable row level security;
alter table poker_private.ring_accounts enable row level security;
revoke all on poker_private.tournament_finishes,poker_private.ring_accounts from public,anon,authenticated;
grant select,insert on poker_private.tournament_finishes to service_role;
-- Read model only; ring-game ledger integration will own balance mutations.
grant select on poker_private.ring_accounts to service_role;
create function poker_private.archive_tournament_finish() returns trigger
language plpgsql security definer set search_path='' as $$
declare tid uuid; rows jsonb; existing jsonb; expected integer;
begin
 if nullif(new.result#>>'{tournament,champion}','') is null then return new; end if;
 select tournament_id into tid from poker_private.tournament_rooms where room_id=new.room_id;
 if tid is null then return new; end if;
 -- Legacy records do not carry the authoritative seat/member mapping. Never guess it.
 if jsonb_typeof(new.result->'participants') is distinct from 'array' then return new; end if;
 select count(*) into expected from poker_private.room_admissions where room_id=new.room_id;
 if expected<2 or jsonb_array_length(new.result->'participants')<>expected then raise exception 'Invalid result roster'; end if;
 select jsonb_agg(jsonb_build_object('memberId',p->>'memberId','seatId',p->>'seatId',
   'name',coalesce(nullif(u.raw_user_meta_data->>'display_name',''),'会員'),
   'place',case when p->>'seatId'=new.result#>>'{tournament,champion}' then 1 else (e->>'place')::integer end,
   'tiedThrough',case when p->>'seatId'=new.result#>>'{tournament,champion}' then 1 else (e->>'tiedThrough')::integer end)
   order by case when p->>'seatId'=new.result#>>'{tournament,champion}' then 1 else (e->>'place')::integer end,p->>'seatId') into rows
 from jsonb_array_elements(new.result->'participants') p
 join poker_private.room_admissions a on a.room_id=new.room_id and a.member_id=(p->>'memberId')::uuid
 join auth.users u on u.id=a.member_id
 left join lateral (select x as e from jsonb_array_elements(new.result#>'{tournament,eliminated}') x where x->>'id'=p->>'seatId') elim on true;
 if rows is null or jsonb_array_length(rows)<>expected
 or (select count(distinct x->>'memberId') from jsonb_array_elements(rows) x)<>expected
 or (select count(distinct x->>'seatId') from jsonb_array_elements(rows) x)<>expected
 or (select count(*) from jsonb_array_elements(rows) x where (x->>'place')::integer=1)<>1
 or exists(select 1 from jsonb_array_elements(rows) x where x->>'place' is null or x->>'tiedThrough' is null or (x->>'place')::integer<1 or (x->>'tiedThrough')::integer<(x->>'place')::integer or (x->>'tiedThrough')::integer>expected)
 then raise exception 'Invalid final standings'; end if;
 insert into poker_private.tournament_finishes values(tid,new.room_id,new.hand_id,new.created_at,rows) on conflict(tournament_id) do nothing;
 select standings into existing from poker_private.tournament_finishes where tournament_id=tid;
 if existing is distinct from rows then raise exception 'Conflicting tournament outcome'; end if;
 return new;
end;
$$;
revoke all on function poker_private.archive_tournament_finish() from public,anon,authenticated;
create trigger archive_tournament_finish after insert or update of result on poker_private.hand_results for each row execute function poker_private.archive_tournament_finish();

-- Session-scoped read API: caller identity is never accepted as a parameter.
create function public.poker_statistics(p_admin boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); payload jsonb;
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required'; end if;
 if p_admin and not coalesce(public.is_admin(),false) then raise exception 'Admin required'; end if;
 with finishes as (
 select f.tournament_id,t.title,f.finished_at,x as row
 from poker_private.tournament_finishes f join public.poker_tournaments t on t.id=f.tournament_id cross join lateral jsonb_array_elements(f.standings) x
 ), totals as (
 select row->>'memberId' member_id,max(row->>'name') name,count(*) played,
 count(*) filter(where (row->>'place')::integer=1) firsts,
 count(*) filter(where (row->>'place')::integer=2) seconds,
 count(*) filter(where (row->>'place')::integer=3) thirds from finishes group by row->>'memberId'
 ), rings as (
 select member_id,available,in_play,available+in_play total,updated_at,rank() over(order by available+in_play desc) position from poker_private.ring_accounts
 )
 select jsonb_build_object('asOf',now(),
 'players',coalesce((select jsonb_agg(to_jsonb(q)) from (select * from totals where p_admin or member_id=who::text order by firsts desc,seconds desc,thirds desc,member_id limit 500) q),'[]'::jsonb),
 'history',coalesce((select jsonb_agg(to_jsonb(q)) from (select tournament_id,title,finished_at,row from finishes where p_admin or row->>'memberId'=who::text order by finished_at desc,tournament_id limit 500) q),'[]'::jsonb),
 'ring',coalesce((select jsonb_agg(to_jsonb(q)) from (select r.*,coalesce(nullif(u.raw_user_meta_data->>'display_name',''),'会員') name from rings r join auth.users u on u.id=r.member_id where p_admin or r.member_id=who order by position,r.member_id limit 500) q),'[]'::jsonb),
 'upcoming',coalesce((select jsonb_agg(to_jsonb(q)) from (select t.id,t.title,t.starts_at,a.room_id from poker_private.tournament_registrations reg join public.poker_tournaments t on t.id=reg.tournament_id left join poker_private.room_admissions a on a.tournament_id=t.id and a.member_id=reg.member_id where reg.member_id=who and not exists(select 1 from poker_private.tournament_finishes f where f.tournament_id=t.id) order by t.starts_at limit 100) q),'[]'::jsonb)) into payload;
 return payload;
end;
$$;
revoke all on function public.poker_statistics(boolean) from public,anon;
grant execute on function public.poker_statistics(boolean) to authenticated;

-- Allow atomic enrichment only through the existing server-owned save path.
grant update on poker_private.hand_results to service_role;
create or replace function public.poker_room_save(p_room uuid,p_expected bigint,p_write uuid,p_sealed jsonb,p_result jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare current_row poker_private.room_checkpoints%rowtype; existing_result jsonb; h uuid;
begin
 if p_room is null or p_write is null or p_expected is null or p_expected<0 or p_expected>=9007199254740991
    or p_sealed is null or jsonb_typeof(p_sealed)<>'object'
    or (p_sealed->>'format') is distinct from '1'
    or coalesce(length(p_sealed->>'data'),0)<1 or length(p_sealed::text)>3000000
    or coalesce(length(p_sealed->>'iv'),0)<>16 or coalesce(length(p_sealed->>'tag'),0)<>24
    or coalesce(p_sealed->>'keyId','') !~ '^[a-zA-Z0-9_-]{1,80}$' then
   raise exception 'Invalid checkpoint';
 end if;
 if p_result is not null and (jsonb_typeof(p_result)<>'object' or p_result->>'handId' is null
    or jsonb_typeof(p_result->'payouts') is distinct from 'object'
    or jsonb_typeof(p_result->'winners') is distinct from 'array' or length(p_result::text)>10000) then
   raise exception 'Invalid terminal result';
 end if;
 -- The insert and row lock serialize initial creation as well as existing owners.
 if p_expected=0 then
   insert into poker_private.room_checkpoints(room_id,version,write_id,sealed)
     values(p_room,0,p_write,p_sealed) on conflict(room_id) do nothing;
 end if;
 select * into current_row from poker_private.room_checkpoints where room_id=p_room for update;
 if not found then raise exception 'Checkpoint conflict'; end if;
 if current_row.version=p_expected+1 and current_row.write_id=p_write
    and current_row.sealed=p_sealed and current_row.last_result is not distinct from p_result then
   return current_row.version; -- lost response retry: no duplicate log or award
 end if;
 if current_row.version<>p_expected or (current_row.version>0 and current_row.write_id=p_write) then
   raise exception 'Checkpoint conflict';
 end if;
 if p_result is not null then
   h=(p_result->>'handId')::uuid;
   insert into poker_private.hand_results(room_id,hand_id,result) values(p_room,h,p_result)
     on conflict(room_id,hand_id) do nothing;
   select result into existing_result from poker_private.hand_results where room_id=p_room and hand_id=h;
   if existing_result is distinct from p_result then
     -- One-way enrichment of legacy records with server-owned seat/member mapping.
     if not (existing_result ? 'participants') and p_result ? 'participants'
        and existing_result = p_result - 'participants' then
       update poker_private.hand_results set result=p_result where room_id=p_room and hand_id=h;
     else raise exception 'Terminal result conflict'; end if;
   end if;
 end if;
 update poker_private.room_checkpoints set version=p_expected+1,write_id=p_write,sealed=p_sealed,
   last_result=p_result,updated_at=now() where room_id=p_room;
 return p_expected+1;
end;
$$;
