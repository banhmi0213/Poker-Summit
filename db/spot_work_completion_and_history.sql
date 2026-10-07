
alter table public.dealer_matching_records
 add column spot_job_id uuid references public.spot_jobs(id) on delete restrict,
 add column job_snapshot jsonb not null default '{}'::jsonb,
 add column store_completed_at timestamptz,
 add column dealer_completed_at timestamptz,
 add column dealer_review text check (dealer_review is null or length(btrim(dealer_review)) between 1 and 2000),
 add column review_saved_at timestamptz;
create unique index matching_job_dealer_start_unique on public.dealer_matching_records(spot_job_id,dealer_user_id,work_start);
create index matching_job_history_idx on public.dealer_matching_records(spot_job_id);
-- Historical jobs remain stored. Owners stop publication rather than delete them.
revoke delete on public.spot_jobs from authenticated;
create function private.protect_spot_history() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='DELETE' then raise exception '過去の求人は削除できません。募集停止をご利用ください。'; end if;
 if exists(select 1 from public.dealer_matching_records where spot_job_id=old.id)
 and (to_jsonb(new)-array['published','updated_at']) is distinct from (to_jsonb(old)-array['published','updated_at'])
 then raise exception '応募がある求人の条件は変更できません。新しい求人として登録してください。'; end if;
 return new;
end $$;
revoke all on function private.protect_spot_history() from public,anon,authenticated;
create trigger protect_spot_history before update or delete on public.spot_jobs for each row execute function private.protect_spot_history();
-- Preserve the original shifts after an application as well as an immutable terms snapshot.
create function private.protect_spot_shift_history() returns trigger language plpgsql security definer set search_path='' as $$
declare v_job uuid;
begin
 if TG_OP='INSERT' then v_job:=new.job_id; else v_job:=old.job_id; end if;
 if exists(select 1 from public.dealer_matching_records where spot_job_id=v_job)
 or (TG_OP='UPDATE' and exists(select 1 from public.dealer_matching_records where spot_job_id=new.job_id))
 then raise exception '応募がある求人の勤務日は変更できません。'; end if;
 if TG_OP='DELETE' then return old; else return new; end if;
end $$;
revoke all on function private.protect_spot_shift_history() from public,anon,authenticated;
create trigger protect_spot_shift_history before insert or update or delete on public.spot_job_shifts for each row execute function private.protect_spot_shift_history();
create function private.request_spot_work(p_job_id uuid,p_work_date date) returns uuid language plpgsql security definer set search_path='' as $$
declare j public.spot_jobs; s public.spot_job_shifts; v_start timestamptz; v_end timestamptz; v_id uuid; v_name text; v_dealer text;
begin
 if auth.uid() is null or public.is_suspended() then raise exception '応募できません。'; end if;
 if not exists(select 1 from public.dealer_profiles where user_id=auth.uid()) or not exists(select 1 from public.user_legal_consents where user_id=auth.uid() and scope='matching_dealer' and terms_version='2026-10-07' and privacy_version='2026-10-07' and rules_version='2026-10-07') then raise exception '登録・同意が必要です。'; end if;
 select * into j from public.spot_jobs where id=p_job_id and published and deadline>now() for update;
 if not found then raise exception '募集は終了しています。'; end if;
 if exists(select 1 from public.stores where id=j.store_id and owner_user_id=auth.uid()) then raise exception '自分の店舗には応募できません。'; end if;
 select * into s from public.spot_job_shifts where job_id=j.id and work_date=p_work_date;
 if not found then raise exception '勤務日がありません。'; end if;
 v_start:=(s.work_date+s.start_time) at time zone 'Asia/Tokyo';
 v_end:=((s.work_date+case when s.end_time<=s.start_time then 1 else 0 end)+s.end_time) at time zone 'Asia/Tokyo';
 if v_start<=now() then raise exception '勤務開始後は応募できません。'; end if;
 select name into v_name from public.stores where id=j.store_id;
 select full_name into v_dealer from public.dealer_profiles where user_id=auth.uid();
 insert into public.dealer_matching_records(store_id,dealer_user_id,work_start,work_end,spot_job_id,job_snapshot)
 values(j.store_id,auth.uid(),v_start,v_end,j.id,jsonb_build_object('store_name',v_name,'dealer_name',v_dealer,'games',j.games,'duties',j.duties,'requirements',j.requirements,'transport_type',j.transport_type,'transport_limit',j.transport_limit,'dress',j.dress,'hourly_wage',s.hourly_wage,'headcount',s.headcount))
 on conflict(spot_job_id,dealer_user_id,work_start) do nothing returning id into v_id;
 if v_id is null then select id into v_id from public.dealer_matching_records where spot_job_id=j.id and dealer_user_id=auth.uid() and work_start=v_start; end if;
 return v_id;
end $$;
create function public.request_spot_work(p_job_id uuid,p_work_date date) returns uuid language sql security invoker set search_path='' as $$ select private.request_spot_work(p_job_id,p_work_date) $$;
create function private.update_spot_work(p_record_id uuid,p_actor text,p_operation text,p_review text default null) returns void language plpgsql security definer set search_path='' as $$
declare r public.dealer_matching_records; v_count integer; v_capacity integer;
begin
 if auth.uid() is null or public.is_suspended() or p_actor not in ('store','dealer') or p_actor is null then raise exception '操作できません。'; end if;
 if not exists(select 1 from public.user_legal_consents where user_id=auth.uid() and scope='matching_'||p_actor and terms_version='2026-10-07' and privacy_version='2026-10-07' and rules_version='2026-10-07') then raise exception '規約への同意が必要です。'; end if;
 -- Serialize confirmations for this job, including final capacity checks.
 perform 1 from public.spot_jobs where id=(select spot_job_id from public.dealer_matching_records where id=p_record_id) for update;
 select * into r from public.dealer_matching_records where id=p_record_id for update;
 if not found then raise exception '勤務がありません。'; end if;
 if (p_actor='dealer' and r.dealer_user_id<>auth.uid()) or (p_actor='store' and not exists(select 1 from public.stores where id=r.store_id and owner_user_id=auth.uid())) then raise exception 'この勤務は操作できません。'; end if;
 if p_operation='confirm' then
  if r.status='confirmed' then return; end if;
  if r.status<>'pending' or r.work_start<=now() then raise exception '条件確定できません。'; end if;
  if p_actor='store' then r.store_confirmed_at:=coalesce(r.store_confirmed_at,now()); else r.dealer_confirmed_at:=coalesce(r.dealer_confirmed_at,now()); end if;
  if r.store_confirmed_at is not null and r.dealer_confirmed_at is not null then
   if r.spot_job_id is not null then
    v_capacity:=(r.job_snapshot->>'headcount')::integer;
    select count(*) into v_count from public.dealer_matching_records where spot_job_id=r.spot_job_id and work_start=r.work_start and status in ('confirmed','completed');
    if v_count>=v_capacity then raise exception '募集人数に達しています。'; end if;
   end if;
   r.status:='confirmed';
  end if;
 elsif p_operation='review' then
  if p_actor<>'dealer' or r.status<>'confirmed' or r.work_end>now() or r.dealer_completed_at is not null or p_review is null or length(btrim(p_review)) not between 1 and 2000 then raise exception '勤務終了後、完了確認前にレビューを1〜2000文字で保存してください。'; end if;
  r.dealer_review:=btrim(p_review); r.review_saved_at:=now();
 elsif p_operation='complete' then
  if r.status='completed' then return; end if;
  if r.status<>'confirmed' or r.work_end>now() then raise exception '勤務終了後に完了してください。'; end if;
  if p_actor='dealer' then
   if r.review_saved_at is null or coalesce(length(btrim(r.dealer_review)),0)=0 then raise exception '先にレビューを保存してください。'; end if;
   r.dealer_completed_at:=coalesce(r.dealer_completed_at,now());
  else r.store_completed_at:=coalesce(r.store_completed_at,now()); end if;
  if r.dealer_completed_at is not null and r.store_completed_at is not null then r.status:='completed'; r.outcome_at:=now(); end if;
 else raise exception '操作を確認してください。';
 end if;
 update public.dealer_matching_records set store_confirmed_at=r.store_confirmed_at,dealer_confirmed_at=r.dealer_confirmed_at,status=r.status,outcome_at=r.outcome_at,store_completed_at=r.store_completed_at,dealer_completed_at=r.dealer_completed_at,dealer_review=r.dealer_review,review_saved_at=r.review_saved_at where id=r.id;
end $$;
create function public.update_spot_work(p_record_id uuid,p_actor text,p_operation text,p_review text default null) returns void language sql security invoker set search_path='' as $$ select private.update_spot_work(p_record_id,p_actor,p_operation,p_review) $$;
grant usage on schema private to authenticated;
revoke all on function private.request_spot_work(uuid,date),public.request_spot_work(uuid,date),private.update_spot_work(uuid,text,text,text),public.update_spot_work(uuid,text,text,text) from public,anon;
grant execute on function private.request_spot_work(uuid,date),public.request_spot_work(uuid,date),private.update_spot_work(uuid,text,text,text),public.update_spot_work(uuid,text,text,text) to authenticated;
