-- 求人を作らずにディーラーへ直接オファー(2026/10/22 オーナー指示)
-- オファーの条件は、非公開の「スカウト用の求人」(scout_only)として残す(チャット・勤務記録・レビューは今までどおり)。
-- 公開しないので、スポット求人の公開の回数は使わない。回数はオファー(ディーラー1人・勤務日1日)の分だけ。
alter table public.spot_jobs add column if not exists scout_only boolean not null default false;

create or replace function public.offer_direct_work(
  p_dealer uuid, p_date date, p_start time, p_end time, p_wage integer,
  p_games text[], p_duties text, p_requirements text, p_transport_type text, p_transport_limit integer,
  p_dress text, p_terms jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_store uuid; v_name text; v_dealer text; v_job uuid; v_start timestamptz; v_end timestamptz; v_id uuid;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  if auth.uid() is null or public.is_suspended() then raise exception '利用できません。'; end if;
  if not exists(select 1 from public.user_legal_consents where user_id=auth.uid() and scope='matching_store' and terms_version='2026-10-07' and privacy_version='2026-10-07' and rules_version='2026-10-07') then raise exception '規約に同意してください。'; end if;
  select id, name into v_store, v_name from public.stores where owner_user_id = auth.uid() order by created_at limit 1;
  if v_store is null then raise exception '店舗が見つかりません。'; end if;
  if p_dealer = auth.uid() or not exists(select 1 from public.dealer_profiles where user_id=p_dealer and published) or exists(select 1 from public.member_status where user_id=p_dealer and suspended) then raise exception 'このディーラーにオファーできません。'; end if;
  if p_date is null or p_date < v_today or p_date > v_today + 2 then raise exception '勤務日は、今日から2日後までの日を選んでください。'; end if;
  if p_start is null or p_end is null or p_start = p_end then raise exception '開始時間と終了時間を入力してください。'; end if;
  if p_wage is null or p_wage < 1 or p_wage > 100000 then raise exception '時給を入力してください。'; end if;
  if p_games is null or cardinality(p_games) < 1 then raise exception 'ゲーム種目を選んでください。'; end if;
  if length(trim(coalesce(p_duties,''))) < 1 then raise exception '業務内容を入力してください。'; end if;
  if p_terms is null or coalesce(p_terms->>'contract_type','') not in ('employment','contract') or coalesce(p_terms->>'payment_method','') not in ('bank','cash')
     or length(trim(coalesce(p_terms->>'payment_date',''))) not between 1 and 100 or length(trim(coalesce(p_terms->>'notes',''))) not between 1 and 2000 then
    raise exception '契約形態・支払方法・支払日・その他の合意事項を入力してください。';
  end if;
  v_start := (p_date + p_start) at time zone 'Asia/Tokyo';
  v_end := ((p_date + case when p_end <= p_start then 1 else 0 end) + p_end) at time zone 'Asia/Tokyo';
  if v_start <= now() then raise exception '勤務開始前にオファーしてください。'; end if;

  insert into public.spot_jobs(store_id,games,duties,requirements,transport_type,transport_limit,dress,deadline,published,scout_only,contract_type,payment_method,payment_date,contract_notes)
  values (v_store,p_games,trim(p_duties),coalesce(trim(p_requirements),''),coalesce(p_transport_type,'none'),case when p_transport_type='limited' then p_transport_limit end,coalesce(trim(p_dress),''),v_start,false,true,
          p_terms->>'contract_type',p_terms->>'payment_method',trim(p_terms->>'payment_date'),trim(p_terms->>'notes'))
  returning id into v_job;
  insert into public.spot_job_shifts(job_id,work_date,start_time,end_time,break_minutes,hourly_wage,headcount) values (v_job,p_date,p_start,p_end,0,p_wage,1);

  select full_name into v_dealer from public.dealer_profiles where user_id=p_dealer;
  insert into public.dealer_matching_records(store_id,dealer_user_id,work_start,work_end,spot_job_id,job_snapshot)
  values(v_store,p_dealer,v_start,v_end,v_job,jsonb_build_object('store_name',v_name,'dealer_name',v_dealer,'games',p_games,'duties',trim(p_duties),'requirements',coalesce(trim(p_requirements),''),'transport_type',coalesce(p_transport_type,'none'),'transport_limit',case when p_transport_type='limited' then p_transport_limit end,'dress',coalesce(trim(p_dress),''),'hourly_wage',p_wage,'headcount',1,'source','store_offer'))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.offer_direct_work(uuid,date,time,time,integer,text[],text,text,text,integer,text,jsonb) from public, anon;
grant execute on function public.offer_direct_work(uuid,date,time,time,integer,text[],text,text,text,integer,text,jsonb) to authenticated;
