begin;
-- Ring configuration catalog. It does not issue chips or provision a game authority.
create table public.poker_ring_tables(
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(btrim(title)) between 1 and 120),
 capacity smallint not null check(capacity in(2,6)),
 sb integer not null check(sb between 1 and 1000000000),
 bb integer not null check(bb between 2 and 1000000000 and bb>sb),
 min_buy_in integer not null check(min_buy_in>=bb and min_buy_in<=1000000000),
 max_buy_in integer not null check(max_buy_in>=min_buy_in and max_buy_in<=1000000000),
 note text not null default '' check(length(note)<=500),
 published boolean not null default false,
 sort_order integer not null default 0 check(sort_order between 0 and 999),
 revision bigint not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,
 check(deleted_at is null or not published)
);
alter table public.poker_ring_tables enable row level security;
revoke all on public.poker_ring_tables from public,anon,authenticated;
grant select on public.poker_ring_tables to anon,authenticated;
create policy poker_ring_tables_read on public.poker_ring_tables for select to anon,authenticated
using(deleted_at is null and (published or ((select public.is_admin()) and not coalesce((select public.is_suspended()),true))));
create index poker_ring_tables_catalog on public.poker_ring_tables(sort_order,created_at,id) where deleted_at is null and published;

create function poker_private.admin_ring_save(p_id uuid,p_expected bigint,p_settings jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row public.poker_ring_tables%rowtype; v_id uuid;
begin
 if auth.uid() is null or not coalesce(public.is_admin(),false) or coalesce(public.is_suspended(),true) then raise exception 'Admin required'; end if;
 if jsonb_typeof(p_settings) is distinct from 'object' then raise exception 'Invalid settings'; end if;
 if p_id is not null then
  select * into row from public.poker_ring_tables where id=p_id for update;
  if not found or row.deleted_at is not null then raise exception 'Table not found'; end if;
  if row.revision is distinct from p_expected then raise exception 'Settings changed; reload'; end if;
 else
  if p_expected is distinct from 0 then raise exception 'Invalid new table revision'; end if;
 end if;
 v_id:=coalesce(p_id,gen_random_uuid());
 insert into public.poker_ring_tables(id,title,capacity,sb,bb,min_buy_in,max_buy_in,note,published,sort_order)
 values(v_id,btrim(p_settings->>'title'),(p_settings->>'capacity')::smallint,(p_settings->>'sb')::integer,(p_settings->>'bb')::integer,
 (p_settings->>'min_buy_in')::integer,(p_settings->>'max_buy_in')::integer,coalesce(p_settings->>'note',''),(p_settings->>'published')::boolean,(p_settings->>'sort_order')::integer)
 on conflict(id) do update set title=excluded.title,capacity=excluded.capacity,sb=excluded.sb,bb=excluded.bb,min_buy_in=excluded.min_buy_in,max_buy_in=excluded.max_buy_in,note=excluded.note,published=excluded.published,sort_order=excluded.sort_order,revision=public.poker_ring_tables.revision+1,updated_at=now();
 select * into row from public.poker_ring_tables where id=v_id;
 return to_jsonb(row);
end;$$;
create function poker_private.admin_ring_remove(p_id uuid,p_expected bigint,p_title text) returns void
language plpgsql security definer set search_path='' as $$
declare row public.poker_ring_tables%rowtype;
begin
 if auth.uid() is null or not coalesce(public.is_admin(),false) or coalesce(public.is_suspended(),true) then raise exception 'Admin required'; end if;
 select * into row from public.poker_ring_tables where id=p_id for update;
 if not found or row.deleted_at is not null then raise exception 'Table not found'; end if;
 if row.title is distinct from p_title or row.revision is distinct from p_expected then raise exception 'Settings changed; reload'; end if;
 update public.poker_ring_tables set published=false,deleted_at=now(),updated_at=now(),revision=revision+1 where id=p_id;
end;$$;
revoke all on function poker_private.admin_ring_save(uuid,bigint,jsonb),poker_private.admin_ring_remove(uuid,bigint,text) from public,anon;
grant execute on function poker_private.admin_ring_save(uuid,bigint,jsonb),poker_private.admin_ring_remove(uuid,bigint,text) to authenticated;
create function public.poker_admin_ring_save(p_id uuid,p_expected bigint,p_settings jsonb) returns jsonb language sql security invoker set search_path='' as $$select poker_private.admin_ring_save(p_id,p_expected,p_settings);$$;
create function public.poker_admin_ring_remove(p_id uuid,p_expected bigint,p_title text) returns void language sql security invoker set search_path='' as $$select poker_private.admin_ring_remove(p_id,p_expected,p_title);$$;
revoke all on function public.poker_admin_ring_save(uuid,bigint,jsonb),public.poker_admin_ring_remove(uuid,bigint,text) from public,anon;
grant execute on function public.poker_admin_ring_save(uuid,bigint,jsonb),public.poker_admin_ring_remove(uuid,bigint,text) to authenticated;

-- Keep foreign keys, hand logs, standings, admissions and image records intact.
alter table public.poker_tournaments add column deleted_at timestamptz;
-- Existing writers can edit settings, but cannot bypass the guarded removal RPC.
revoke update on public.poker_tournaments from authenticated;
grant update(title,owner_store_id,starts_at,published,structure,image_url,image_path,organizer_name,prizes) on public.poker_tournaments to authenticated;
alter table public.poker_tournaments add constraint poker_deleted_unpublished check(deleted_at is null or not published);
create function poker_private.guard_tournament_removal() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.deleted_at is not null then raise exception 'Cannot insert removed tournament'; end if;
 else
  if old.deleted_at is not null then raise exception 'Tournament removed'; end if;
  if new.deleted_at is distinct from old.deleted_at and (auth.uid() is null or not coalesce(public.is_admin(),false) or coalesce(public.is_suspended(),true)) then raise exception 'Admin required'; end if;
 end if;
 return new;
end;$$;
revoke all on function poker_private.guard_tournament_removal() from public,anon,authenticated;
create trigger guard_tournament_removal before insert or update on public.poker_tournaments for each row execute function poker_private.guard_tournament_removal();
create function poker_private.admin_tournament_remove(p_id uuid,p_title text) returns void
language plpgsql security definer set search_path='' as $$
declare row public.poker_tournaments%rowtype;
begin
 if auth.uid() is null or not coalesce(public.is_admin(),false) or coalesce(public.is_suspended(),true) then raise exception 'Admin required'; end if;
 select * into row from public.poker_tournaments where id=p_id for update;
 if not found or row.deleted_at is not null then raise exception 'Tournament not found'; end if;
 if row.title is distinct from p_title then raise exception 'Settings changed; reload'; end if;
 -- Locking the tournament also serializes against admission/finalization/provision.
 if exists(select 1 from poker_private.tournament_rooms r left join poker_private.tournament_finishes f on f.tournament_id=r.tournament_id where r.tournament_id=p_id and (f.finished_at is null or clock_timestamp()<f.finished_at+interval '10 minutes')) then raise exception 'Tournament active or results still displayed'; end if;
 update poker_private.registration_policies set enabled=false where tournament_id=p_id;
 update poker_private.entry_settings set automatic=false where tournament_id=p_id;
 update poker_private.tournament_rooms set enabled=false where tournament_id=p_id;
 update public.poker_tournaments set published=false,deleted_at=now() where id=p_id;
end;$$;
revoke all on function poker_private.admin_tournament_remove(uuid,text) from public,anon;
grant execute on function poker_private.admin_tournament_remove(uuid,text) to authenticated;
create function public.poker_admin_tournament_remove(p_id uuid,p_title text) returns void language sql security invoker set search_path='' as $$select poker_private.admin_tournament_remove(p_id,p_title);$$;
revoke all on function public.poker_admin_tournament_remove(uuid,text) from public,anon;
grant execute on function public.poker_admin_tournament_remove(uuid,text) to authenticated;

-- Removed entries disappear from upcoming events; history still joins the retained record.
create or replace function public.poker_statistics(p_admin boolean default false) returns jsonb
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
 'upcoming',coalesce((select jsonb_agg(to_jsonb(q)) from (select t.id,t.title,t.starts_at,a.room_id from poker_private.tournament_registrations reg join public.poker_tournaments t on t.id=reg.tournament_id left join poker_private.room_admissions a on a.tournament_id=t.id and a.member_id=reg.member_id where t.deleted_at is null and reg.member_id=who and not exists(select 1 from poker_private.tournament_finishes f where f.tournament_id=t.id) order by t.starts_at limit 100) q),'[]'::jsonb)) into payload;
 return payload;
end;
$$;
commit;
