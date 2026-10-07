alter table public.dealer_matching_records add column store_review text check(store_review is null or length(btrim(store_review)) between 1 and 2000), add column store_review_saved_at timestamptz;
create or replace function private.update_spot_work(p_record_id uuid,p_actor text,p_operation text,p_review text default null) returns void language plpgsql security definer set search_path='' as $$
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
  if r.status<>'confirmed' or r.work_end>now() or (p_actor='dealer' and r.dealer_completed_at is not null) or (p_actor='store' and r.store_completed_at is not null) or p_review is null or length(btrim(p_review)) not between 1 and 2000 then raise exception '勤務終了後、完了確認前にレビューを1〜2000文字で保存してください。'; end if;
  if p_actor='dealer' then r.dealer_review:=btrim(p_review); r.review_saved_at:=now(); else r.store_review:=btrim(p_review); r.store_review_saved_at:=now(); end if;
 elsif p_operation='complete' then
  if r.status='completed' then return; end if;
  if r.status<>'confirmed' or r.work_end>now() then raise exception '勤務終了後に完了してください。'; end if;
  if p_actor='dealer' then
   if r.review_saved_at is null or coalesce(length(btrim(r.dealer_review)),0)=0 then raise exception '先にレビューを保存してください。'; end if;
   r.dealer_completed_at:=coalesce(r.dealer_completed_at,now());
  else
   if r.store_review_saved_at is null or coalesce(length(btrim(r.store_review)),0)=0 then raise exception '先にディーラーへのレビューを保存してください。'; end if;
   r.store_completed_at:=coalesce(r.store_completed_at,now()); end if;
  if r.dealer_completed_at is not null and r.store_completed_at is not null then r.status:='completed'; r.outcome_at:=now(); end if;
 else raise exception '操作を確認してください。';
 end if;
 update public.dealer_matching_records set store_confirmed_at=r.store_confirmed_at,dealer_confirmed_at=r.dealer_confirmed_at,status=r.status,outcome_at=r.outcome_at,store_completed_at=r.store_completed_at,dealer_completed_at=r.dealer_completed_at,dealer_review=r.dealer_review,review_saved_at=r.review_saved_at,store_review=r.store_review,store_review_saved_at=r.store_review_saved_at where id=r.id;
end $$;
