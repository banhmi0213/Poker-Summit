create table public.spot_jobs (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.stores(id) on delete cascade,
 games text[] not null check(cardinality(games) between 1 and 20),
 duties text not null check(char_length(duties) between 1 and 3000),
 requirements text not null default '' check(char_length(requirements)<=3000),
 transport_type text not null default 'none' check(transport_type in ('none','full','limited')),
 transport_limit integer check(transport_limit between 0 and 100000),
 dress text not null default '' check(char_length(dress)<=2000),
 deadline timestamptz not null,
 image_path text check(image_path is null or image_path ~ ('^'||store_id::text||'/[0-9a-f-]{36}\.(jpg|png|webp)$')),
 published boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(transport_type<>'limited' or transport_limit is not null)
);
create table public.spot_job_shifts (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.spot_jobs(id) on delete cascade,
 work_date date not null,
 start_time time not null,
 end_time time not null,
 break_minutes integer not null check(break_minutes between 0 and 1440),
 hourly_wage integer not null check(hourly_wage between 1 and 100000),
 headcount integer not null check(headcount between 1 and 1000),
 unique(job_id,work_date),
 check(start_time<>end_time),
 check(break_minutes*60 < extract(epoch from (end_time-start_time)) + case when end_time<start_time then 86400 else 0 end)
);
create index spot_jobs_store_idx on public.spot_jobs(store_id);
create index spot_job_shifts_date_idx on public.spot_job_shifts(work_date,job_id);
alter table public.spot_jobs enable row level security;
alter table public.spot_job_shifts enable row level security;
revoke all on public.spot_jobs,public.spot_job_shifts from anon;
grant select,insert,update,delete on public.spot_jobs,public.spot_job_shifts to authenticated;
create policy spot_owner_select on public.spot_jobs for select to authenticated using(exists(select 1 from public.stores s where s.id=store_id and s.owner_user_id=(select auth.uid())));
create policy spot_dealer_select on public.spot_jobs for select to authenticated using(published and deadline>now() and not (select public.is_suspended()) and exists(select 1 from public.dealer_profiles d where d.user_id=(select auth.uid())));
create policy spot_owner_insert on public.spot_jobs for insert to authenticated with check(not (select public.is_suspended()) and exists(select 1 from public.stores s where s.id=store_id and s.owner_user_id=(select auth.uid())));
create policy spot_owner_update on public.spot_jobs for update to authenticated using(exists(select 1 from public.stores s where s.id=store_id and s.owner_user_id=(select auth.uid()))) with check(not (select public.is_suspended()) and exists(select 1 from public.stores s where s.id=store_id and s.owner_user_id=(select auth.uid())));
create policy spot_owner_delete on public.spot_jobs for delete to authenticated using(exists(select 1 from public.stores s where s.id=store_id and s.owner_user_id=(select auth.uid())));
create policy spot_shift_read on public.spot_job_shifts for select to authenticated using(exists(select 1 from public.spot_jobs j where j.id=job_id));
create policy spot_shift_insert on public.spot_job_shifts for insert to authenticated with check(exists(select 1 from public.spot_jobs j join public.stores s on s.id=j.store_id where j.id=job_id and s.owner_user_id=(select auth.uid())));
create policy spot_shift_update on public.spot_job_shifts for update to authenticated using(exists(select 1 from public.spot_jobs j join public.stores s on s.id=j.store_id where j.id=job_id and s.owner_user_id=(select auth.uid()))) with check(exists(select 1 from public.spot_jobs j join public.stores s on s.id=j.store_id where j.id=job_id and s.owner_user_id=(select auth.uid())));
create policy spot_shift_delete on public.spot_job_shifts for delete to authenticated using(exists(select 1 from public.spot_jobs j join public.stores s on s.id=j.store_id where j.id=job_id and s.owner_user_id=(select auth.uid())));
create function public.save_spot_job(p_id uuid,p_store_id uuid,p_games text[],p_duties text,p_requirements text,p_transport_type text,p_transport_limit integer,p_dress text,p_deadline timestamptz,p_image text,p_published boolean,p_shifts jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null or public.is_suspended() then raise exception '保存できません。'; end if;
 if not exists(select 1 from public.stores s where s.id=p_store_id and s.owner_user_id=auth.uid()) then raise exception '店舗が見つかりません。'; end if;
 if p_shifts is null or jsonb_typeof(p_shifts)<>'array' or jsonb_array_length(p_shifts) not between 1 and 90 then raise exception '勤務日を1〜90日選んでください。'; end if;
 if p_published and (p_deadline is null or p_deadline<=now()) then raise exception '応募締切は現在より後で指定してください。'; end if;
 if p_id is null then
 insert into public.spot_jobs(store_id,games,duties,requirements,transport_type,transport_limit,dress,deadline,image_path,published)
 values(p_store_id,p_games,p_duties,p_requirements,p_transport_type,p_transport_limit,p_dress,p_deadline,p_image,p_published) returning id into v_id;
 else
 update public.spot_jobs set games=p_games,duties=p_duties,requirements=p_requirements,transport_type=p_transport_type,transport_limit=p_transport_limit,dress=p_dress,deadline=p_deadline,image_path=p_image,published=p_published,updated_at=now()
 where id=p_id and store_id=p_store_id returning id into v_id;
 if v_id is null then raise exception '求人が見つかりません。'; end if;
 delete from public.spot_job_shifts where job_id=v_id;
 end if;
 insert into public.spot_job_shifts(job_id,work_date,start_time,end_time,break_minutes,hourly_wage,headcount)
 select v_id,work_date,start_time,end_time,break_minutes,hourly_wage,headcount
 from jsonb_to_recordset(p_shifts) as x(work_date date,start_time time,end_time time,break_minutes integer,hourly_wage integer,headcount integer);
 return v_id;
end;
$$;
revoke all on function public.save_spot_job(uuid,uuid,text[],text,text,text,integer,text,timestamptz,text,boolean,jsonb) from public,anon;
grant execute on function public.save_spot_job(uuid,uuid,text[],text,text,text,integer,text,timestamptz,text,boolean,jsonb) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('spot-job-images','spot-job-images',false,3145728,array['image/jpeg','image/png','image/webp']);
create policy spot_image_insert on storage.objects for insert to authenticated with check (
bucket_id='spot-job-images' and exists (select 1 from public.stores s where s.id::text=(storage.foldername(objects.name))[1] and s.owner_user_id=(select auth.uid()))
);
create policy spot_image_delete on storage.objects for delete to authenticated using (
bucket_id='spot-job-images' and exists (select 1 from public.stores s where s.id::text=(storage.foldername(objects.name))[1] and s.owner_user_id=(select auth.uid()))
);
create policy spot_image_read on storage.objects for select to authenticated using (
bucket_id='spot-job-images' and (
exists (select 1 from public.stores s where s.id::text=(storage.foldername(objects.name))[1] and s.owner_user_id=(select auth.uid()))
or exists (select 1 from public.spot_jobs j where j.image_path=objects.name and j.published)
)
);
