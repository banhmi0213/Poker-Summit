-- Additive configuration only; existing events, wallets and game tables are untouched.
begin;
create function public.valid_poker_structure(s jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare p jsonb; levels integer:=0; previous_sb bigint:=0; previous_bb bigint:=0; sb bigint; bb bigint; ante bigint; mins integer;
begin
 if s is null or jsonb_typeof(s) is distinct from 'object' or not(s ?& array['startingStack','anteType','lateRegLevel','reentry','periods']) or jsonb_typeof(s->'startingStack')<>'number' or (s->>'startingStack')!~'^[0-9]+$' or (s->>'startingStack')::bigint not between 1 and 1000000000
 or coalesce(s->>'anteType','') not in ('none','bb','per-player') or jsonb_typeof(s->'reentry')<>'boolean' or jsonb_typeof(s->'periods')<>'array' then return false; end if;
 if jsonb_array_length(s->'periods') not between 1 and 100 or s->'periods'->0->>'kind' is distinct from 'level' or s->'periods'->(-1)->>'kind' is distinct from 'level' then return false; end if;
 for p in select value from jsonb_array_elements(s->'periods') loop
  if jsonb_typeof(p) is distinct from 'object' or not(p ?& array['kind','minutes','sb','bb','ante','note']) or coalesce(p->>'kind','') not in ('level','break') or jsonb_typeof(p->'minutes')<>'number' or (p->>'minutes')!~'^[0-9]+$' or jsonb_typeof(p->'note')<>'string' or length(p->>'note')>200 then return false; end if;
  mins:=(p->>'minutes')::integer;if mins not between 1 and 240 then return false; end if;
  if p->>'kind'='level' then
   if jsonb_typeof(p->'sb')<>'number' or jsonb_typeof(p->'bb')<>'number' or jsonb_typeof(p->'ante')<>'number' or (p->>'sb')!~'^[0-9]+$' or (p->>'bb')!~'^[0-9]+$' or (p->>'ante')!~'^[0-9]+$' then return false; end if;
   sb:=(p->>'sb')::bigint;bb:=(p->>'bb')::bigint;ante:=(p->>'ante')::bigint;
   if sb not between 1 and 1000000000 or bb<sb or bb>1000000000 or ante not between 0 and 1000000000 or sb<previous_sb or bb<previous_bb or (s->>'anteType'='none' and ante<>0) then return false; end if;
   previous_sb:=sb;previous_bb:=bb;levels:=levels+1;
  else
   if p->'sb'<>'0'::jsonb or p->'bb'<>'0'::jsonb or p->'ante'<>'0'::jsonb then return false; end if;
  end if;
 end loop;
 if jsonb_typeof(s->'lateRegLevel')<>'number' or (s->>'lateRegLevel')!~'^[0-9]+$' then return false; end if;
 return (s->>'lateRegLevel')::integer between 0 and levels;
exception when others then return false;
end;
$$;
create table public.poker_tournaments (
 id uuid primary key default gen_random_uuid(),
 owner_store_id uuid references public.stores(id) on delete restrict,
 title text not null check(char_length(btrim(title)) between 1 and 120),
 starts_at timestamptz not null check(isfinite(starts_at)),
 published boolean not null default false,
 structure jsonb not null check(public.valid_poker_structure(structure) is true),
 image_url text,
 image_path text,
 created_at timestamptz not null default now(),
 check((image_url is null)=(image_path is null))
);
create index poker_tournaments_published_start on public.poker_tournaments(starts_at) where published;
create index poker_tournaments_owner on public.poker_tournaments(owner_store_id);
alter table public.poker_tournaments enable row level security;
grant select on public.poker_tournaments to anon;
grant select,insert,update on public.poker_tournaments to authenticated;
create policy poker_tournaments_read on public.poker_tournaments for select to anon,authenticated using(published or (not (select public.is_suspended()) and ((select public.is_admin()) or exists(select 1 from public.stores s where s.id=owner_store_id and s.owner_user_id=(select auth.uid())))));
create policy poker_tournaments_insert on public.poker_tournaments for insert to authenticated with check(not (select public.is_suspended()) and ((select public.is_admin()) or exists(select 1 from public.stores s where s.id=owner_store_id and s.owner_user_id=(select auth.uid()))));
create policy poker_tournaments_update on public.poker_tournaments for update to authenticated using(not (select public.is_suspended()) and ((select public.is_admin()) or exists(select 1 from public.stores s where s.id=owner_store_id and s.owner_user_id=(select auth.uid())))) with check(not (select public.is_suspended()) and ((select public.is_admin()) or exists(select 1 from public.stores s where s.id=owner_store_id and s.owner_user_id=(select auth.uid()))));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('poker-tournament-images','poker-tournament-images',true,2097152,array['image/png','image/jpeg','image/webp']);
create policy poker_tournament_images_manage on storage.objects for all to authenticated
using(bucket_id='poker-tournament-images' and not (select public.is_suspended()) and ((select public.is_admin()) or ((storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.stores s where s.owner_user_id=(select auth.uid())))))
with check(bucket_id='poker-tournament-images' and not (select public.is_suspended()) and ((select public.is_admin()) or ((storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.stores s where s.owner_user_id=(select auth.uid())))));
commit;
