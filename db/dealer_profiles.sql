create table public.dealer_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null check (char_length(full_name) between 1 and 100),
 age integer not null check (age between 0 and 120),
 pref text not null,
 games text[] not null check (cardinality(games) between 1 and 20),
 experience_years numeric(4,1) not null check (experience_years between 0 and 80),
 appeal text not null default '' check (char_length(appeal)<=3000),
 photo_url text,
 dealer_type text not null default 'ディーラー' check (dealer_type in ('ディーラー','フリーディーラー')),
 published boolean not null default true,
 updated_at timestamptz not null default now()
);
create table public.dealer_addresses (
 user_id uuid primary key references auth.users(id) on delete cascade,
 address text not null check (char_length(address) between 1 and 300)
);
alter table public.dealer_profiles enable row level security;
alter table public.dealer_addresses enable row level security;
grant select on public.dealer_profiles to anon;
grant select,insert,update on public.dealer_profiles,public.dealer_addresses to authenticated;
create policy dealer_public_read on public.dealer_profiles for select to anon,authenticated using (published or (select auth.uid())=user_id);
create policy dealer_own_insert on public.dealer_profiles for insert to authenticated with check ((select auth.uid())=user_id);
create policy dealer_own_update on public.dealer_profiles for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy dealer_address_own_read on public.dealer_addresses for select to authenticated using ((select auth.uid())=user_id);
create policy dealer_address_own_insert on public.dealer_addresses for insert to authenticated with check ((select auth.uid())=user_id);
create policy dealer_address_own_update on public.dealer_addresses for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create function public.save_dealer_profile(p_name text,p_age integer,p_pref text,p_address text,p_games text[],p_years numeric,p_appeal text,p_photo text,p_type text,p_published boolean)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or public.is_suspended() then raise exception '登録できません。'; end if;
 insert into public.dealer_profiles(user_id,full_name,age,pref,games,experience_years,appeal,photo_url,dealer_type,published)
 values(auth.uid(),p_name,p_age,p_pref,p_games,p_years,p_appeal,p_photo,p_type,p_published)
 on conflict(user_id) do update set full_name=excluded.full_name,age=excluded.age,pref=excluded.pref,games=excluded.games,experience_years=excluded.experience_years,appeal=excluded.appeal,photo_url=excluded.photo_url,dealer_type=excluded.dealer_type,published=excluded.published,updated_at=now();
 insert into public.dealer_addresses(user_id,address) values(auth.uid(),p_address)
 on conflict(user_id) do update set address=excluded.address;
 insert into public.profiles(user_id,role,updated_at) values(auth.uid(),p_type,now())
 on conflict(user_id) do update set role=excluded.role,updated_at=now();
end;
$$;
revoke all on function public.save_dealer_profile(text,integer,text,text,text[],numeric,text,text,text,boolean) from public;
grant execute on function public.save_dealer_profile(text,integer,text,text,text[],numeric,text,text,text,boolean) to authenticated;
drop policy dealer_public_read on public.dealer_profiles;
revoke select on public.dealer_profiles from anon;
create policy dealer_authorized_read on public.dealer_profiles for select to authenticated using (
 (select auth.uid())=user_id or (published and exists(select 1 from public.stores s where s.owner_user_id=(select auth.uid())))
);
create policy dealer_address_store_read on public.dealer_addresses for select to authenticated using (
 exists(select 1 from public.stores s where s.owner_user_id=(select auth.uid()))
 and exists(select 1 from public.dealer_profiles d where d.user_id=dealer_addresses.user_id and d.published)
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('dealer-photos','dealer-photos',false,3145728,array['image/jpeg','image/png','image/webp']);
create policy dealer_photo_insert on storage.objects for insert to authenticated with check(bucket_id='dealer-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy dealer_photo_delete on storage.objects for delete to authenticated using(bucket_id='dealer-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy dealer_photo_read on storage.objects for select to authenticated using(bucket_id='dealer-photos' and (
 (storage.foldername(name))[1]=(select auth.uid())::text or (
 exists(select 1 from public.stores s where s.owner_user_id=(select auth.uid()))
 and exists(select 1 from public.dealer_profiles d where d.user_id::text=(storage.foldername(name))[1] and d.published)
)));

revoke all on public.dealer_profiles,public.dealer_addresses from anon;
revoke all on function public.save_dealer_profile(text,integer,text,text,text[],numeric,text,text,text,boolean) from anon;