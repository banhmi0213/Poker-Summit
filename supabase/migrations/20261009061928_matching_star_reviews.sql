-- Historical written reviews remain unrated. Ratings belong to their author.
alter table public.dealer_matching_records
 add column dealer_rating smallint check (dealer_rating between 1 and 5),
 add column store_rating smallint check (store_rating between 1 and 5);
CREATE OR REPLACE FUNCTION private.update_spot_work_with_rating(p_record_id uuid, p_actor text, p_operation text, p_review text, p_rating integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if not private.chat_ready(p_record_id) or not exists(select 1 from public.dealer_chat_terms t where t.record_id=p_record_id and current_setting('app.chat.confirm_record',true)=p_record_id::text and current_setting('app.chat.confirm_revision',true)=t.revision::text) or exists(select 1 from public.dealer_chat_blocks where record_id=p_record_id) then raise exception 'チャットで最新の勤務条件を確認・合意してください。'; end if;
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
  if p_rating is null or p_rating not between 1 and 5 then raise exception '星評価を1〜5で選択してください。'; end if;
  if r.status<>'confirmed' or r.work_end>now() or (p_actor='dealer' and r.dealer_completed_at is not null) or (p_actor='store' and r.store_completed_at is not null) or p_review is null or length(btrim(p_review)) not between 1 and 2000 then raise exception '勤務終了後、完了確認前にレビューを1〜2000文字で保存してください。'; end if;
  if p_actor='dealer' then r.dealer_rating:=p_rating; r.dealer_review:=btrim(p_review); r.review_saved_at:=now(); else r.store_rating:=p_rating; r.store_review:=btrim(p_review); r.store_review_saved_at:=now(); end if;
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
 update public.dealer_matching_records set dealer_rating=r.dealer_rating,store_rating=r.store_rating,store_confirmed_at=r.store_confirmed_at,dealer_confirmed_at=r.dealer_confirmed_at,status=r.status,outcome_at=r.outcome_at,store_completed_at=r.store_completed_at,dealer_completed_at=r.dealer_completed_at,dealer_review=r.dealer_review,review_saved_at=r.review_saved_at,store_review=r.store_review,store_review_saved_at=r.store_review_saved_at where id=r.id;
end $function$;

-- Preserve the chat confirmation guard and existing completion callers.
create or replace function private.update_spot_work(p_record_id uuid,p_actor text,p_operation text,p_review text default null)
returns void language sql security invoker set search_path='' as $$
 select private.update_spot_work_with_rating(p_record_id,p_actor,p_operation,p_review,null);
$$;
create function public.update_spot_work_with_rating(p_record_id uuid,p_actor text,p_operation text,p_review text,p_rating integer)
returns void language sql security invoker set search_path='' as $$
 select private.update_spot_work_with_rating(p_record_id,p_actor,p_operation,p_review,p_rating);
$$;
revoke all on function private.update_spot_work_with_rating(uuid,text,text,text,integer),public.update_spot_work_with_rating(uuid,text,text,text,integer) from public,anon;
grant execute on function private.update_spot_work_with_rating(uuid,text,text,text,integer),public.update_spot_work_with_rating(uuid,text,text,text,integer) to authenticated;

-- A safe projection, never other stores' contracts, contact details or chat.
create function private.get_dealer_reviews(p_dealer_id uuid,p_offset integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 -- Reuse the established store/self, suspension and publication restrictions.
 if not exists(select 1 from public.get_dealer_reliability(array[p_dealer_id])) then raise exception '閲覧できません。'; end if;
 if p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'ページを確認してください。'; end if;
 with eligible as (
  select r.id,r.store_rating as rating,r.store_review as review,s.name as store_name,r.work_start,r.store_review_saved_at as reviewed_at
  from public.dealer_matching_records r join public.stores s on s.id=r.store_id
  where r.dealer_user_id=p_dealer_id and r.status='completed' and r.work_end<=now() and r.outcome_at<=now()
   and r.store_confirmed_at is not null and r.dealer_confirmed_at is not null
   and r.store_completed_at is not null and r.dealer_completed_at is not null and r.store_review is not null
 ), page as (select * from eligible order by reviewed_at desc nulls last,id limit 10 offset p_offset)
 select jsonb_build_object('count',(select count(*) from eligible),'average',(select avg(rating) from eligible),'rating_count',(select count(rating) from eligible),'reviews',coalesce((select jsonb_agg(to_jsonb(page) order by reviewed_at desc nulls last,id) from page),'[]'::jsonb)) into result;
 return result;
end $$;
create function public.get_dealer_reviews(p_dealer_id uuid,p_offset integer default 0)
returns jsonb language sql security invoker set search_path='' as $$ select private.get_dealer_reviews(p_dealer_id,p_offset); $$;
revoke all on function private.get_dealer_reviews(uuid,integer),public.get_dealer_reviews(uuid,integer) from public,anon;
grant execute on function private.get_dealer_reviews(uuid,integer),public.get_dealer_reviews(uuid,integer) to authenticated;

create function private.get_dealer_reputation(p_dealer_ids uuid[])
returns table(dealer_user_id uuid,total bigint,completed bigint,cancellations bigint,no_shows bigint,average numeric,rating_count bigint,review_count bigint,latest_review jsonb)
language plpgsql security definer set search_path='' as $$
begin
 return query select b.dealer_user_id,b.total,b.completed,b.cancellations,b.no_shows,(j.data->>'average')::numeric,(j.data->>'rating_count')::bigint,(j.data->>'count')::bigint,j.data->'reviews'->0
 from public.get_dealer_reliability(p_dealer_ids) b
 cross join lateral (select private.get_dealer_reviews(b.dealer_user_id,0) as data) j;
end $$;
create function public.get_dealer_reputation(p_dealer_ids uuid[])
returns table(dealer_user_id uuid,total bigint,completed bigint,cancellations bigint,no_shows bigint,average numeric,rating_count bigint,review_count bigint,latest_review jsonb)
language sql security invoker set search_path='' as $$ select * from private.get_dealer_reputation(p_dealer_ids); $$;
revoke all on function private.get_dealer_reputation(uuid[]),public.get_dealer_reputation(uuid[]) from public,anon;
grant execute on function private.get_dealer_reputation(uuid[]),public.get_dealer_reputation(uuid[]) to authenticated;
create index dealer_completed_reviews_idx on public.dealer_matching_records(dealer_user_id,store_review_saved_at desc,id) where status='completed' and store_review is not null;
