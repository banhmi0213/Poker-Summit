begin;
create schema if not exists poker_private;
revoke all on schema poker_private from public,anon;
grant usage on schema poker_private to authenticated;

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
declare row public.poker_tournaments%rowtype; active boolean;
begin
 if auth.uid() is null or not coalesce(public.is_admin(),false) or coalesce(public.is_suspended(),true) then raise exception 'Admin required'; end if;
 select * into row from public.poker_tournaments where id=p_id for update;
 if not found or row.deleted_at is not null then raise exception 'Tournament not found'; end if;
 if row.title is distinct from p_title then raise exception 'Settings changed; reload'; end if;
 -- Locking the tournament also serializes against admission/finalization/provision.
 if to_regclass('poker_private.tournament_rooms') is not null then
  if to_regclass('poker_private.tournament_finishes') is null then raise exception 'Tournament active or results still displayed'; end if;
  execute 'select exists(select 1 from poker_private.tournament_rooms r left join poker_private.tournament_finishes f on f.tournament_id=r.tournament_id where r.tournament_id=$1 and (f.finished_at is null or clock_timestamp()<f.finished_at+interval ''10 minutes''))' into active using p_id;
  if active then raise exception 'Tournament active or results still displayed'; end if;
  execute 'update poker_private.tournament_rooms set enabled=false where tournament_id=$1' using p_id;
 end if;
 if to_regclass('poker_private.registration_policies') is not null then execute 'update poker_private.registration_policies set enabled=false where tournament_id=$1' using p_id;end if;
 if to_regclass('poker_private.entry_settings') is not null then execute 'update poker_private.entry_settings set automatic=false where tournament_id=$1' using p_id;end if;
 update public.poker_tournaments set published=false,deleted_at=now() where id=p_id;
end;$$;
revoke all on function poker_private.admin_tournament_remove(uuid,text) from public,anon;
grant execute on function poker_private.admin_tournament_remove(uuid,text) to authenticated;
create function public.poker_admin_tournament_remove(p_id uuid,p_title text) returns void language sql security invoker set search_path='' as $$select poker_private.admin_tournament_remove(p_id,p_title);$$;
revoke all on function public.poker_admin_tournament_remove(uuid,text) from public,anon;
grant execute on function public.poker_admin_tournament_remove(uuid,text) to authenticated;


commit;
