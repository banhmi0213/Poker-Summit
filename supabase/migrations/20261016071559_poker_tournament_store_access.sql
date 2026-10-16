-- Default deny: absence of a permission row means the store cannot manage tournaments.
-- Keep ownership, public read policies and every other store feature unchanged.
begin;
create table public.poker_tournament_store_access (
 store_id uuid primary key references public.stores(id) on delete cascade,
 enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.poker_tournament_store_access enable row level security;
revoke all on public.poker_tournament_store_access from public,anon;
grant select,insert,update on public.poker_tournament_store_access to authenticated;
create policy poker_tournament_access_read on public.poker_tournament_store_access
 for select to authenticated using (
 not (select public.is_suspended()) and ((select public.is_admin()) or exists (
 select 1 from public.stores s where s.id=store_id and s.owner_user_id=(select auth.uid())
 )));
create policy poker_tournament_access_insert on public.poker_tournament_store_access
 for insert to authenticated with check (not (select public.is_suspended()) and (select public.is_admin()));
create policy poker_tournament_access_update on public.poker_tournament_store_access
 for update to authenticated using (not (select public.is_suspended()) and (select public.is_admin()))
 with check (not (select public.is_suspended()) and (select public.is_admin()));
-- Restrictive policies are ANDed with existing ownership/suspension policies.
create policy poker_tournaments_access_insert on public.poker_tournaments as restrictive
 for insert to authenticated with check (
 (select public.is_admin()) or exists (
 select 1 from public.poker_tournament_store_access a join public.stores s on s.id=a.store_id
 where a.store_id=owner_store_id and a.enabled and s.owner_user_id=(select auth.uid())
 ));
create policy poker_tournaments_access_update on public.poker_tournaments as restrictive
 for update to authenticated using (
 (select public.is_admin()) or exists (
 select 1 from public.poker_tournament_store_access a join public.stores s on s.id=a.store_id
 where a.store_id=owner_store_id and a.enabled and s.owner_user_id=(select auth.uid())
 )) with check (
 (select public.is_admin()) or exists (
 select 1 from public.poker_tournament_store_access a join public.stores s on s.id=a.store_id
 where a.store_id=owner_store_id and a.enabled and s.owner_user_id=(select auth.uid())
 ));
-- New store uploads use user_id/store_id/random-file. Legacy files remain manageable
-- only when linked to a tournament for a currently permitted store.
create policy poker_tournament_images_access on storage.objects as restrictive
 for all to authenticated using (
 bucket_id <> 'poker-tournament-images' or (select public.is_admin()) or (
 (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text and exists (
 select 1 from public.poker_tournament_store_access a join public.stores s on s.id=a.store_id
 where a.enabled and s.owner_user_id=(select auth.uid()) and (
 (storage.foldername(storage.objects.name))[2]=s.id::text or exists (
 select 1 from public.poker_tournaments t where t.owner_store_id=s.id and t.image_path=storage.objects.name
 ))))) with check (
 bucket_id <> 'poker-tournament-images' or (select public.is_admin()) or (
 (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text and exists (
 select 1 from public.poker_tournament_store_access a join public.stores s on s.id=a.store_id
 where a.enabled and s.owner_user_id=(select auth.uid()) and (
 (storage.foldername(storage.objects.name))[2]=s.id::text or exists (
 select 1 from public.poker_tournaments t where t.owner_store_id=s.id and t.image_path=storage.objects.name
 )))));
commit;
