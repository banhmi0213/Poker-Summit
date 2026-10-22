-- チャットから同じディーラーに別の日も頼む(2026/10/22 オーナー指示)。
-- 条件はこのチャットの求人・勤務条件をそのまま使い、勤務日1日ごとにオファー(1回)を作る。
-- 回数が足りないときは「◯回分足りません」と止める(途中まで作らない)。
create or replace function public.offer_more_days(p_record uuid, p_dates date[], p_start time, p_end time)
returns uuid[] language plpgsql security definer set search_path = public as $$
declare r public.dealer_matching_records; j public.spot_jobs; t public.dealer_chat_terms; v_ids uuid[] := '{}'; v_id uuid; v_job uuid;
  d date; v_start timestamptz; v_end timestamptz; v_need integer; v_has boolean; v_limit integer; v_left integer; v_credit integer; v_name text; v_dealer text;
  v_today date := (now() at time zone 'Asia/Tokyo')::date; v_wage integer;
begin
  if auth.uid() is null or public.is_suspended() then raise exception '利用できません。'; end if;
  if not exists(select 1 from public.user_legal_consents where user_id=auth.uid() and scope='matching_store' and terms_version='2026-10-07' and privacy_version='2026-10-07' and rules_version='2026-10-07') then raise exception '規約に同意してください。'; end if;
  select * into r from public.dealer_matching_records where id = p_record;
  if not found or not exists(select 1 from public.stores where id=r.store_id and owner_user_id=auth.uid()) then raise exception 'このチャットは操作できません。'; end if;
  if exists(select 1 from public.dealer_chat_blocks where record_id=p_record) then raise exception 'ブロック中のためオファーできません。'; end if;
  if not exists(select 1 from public.dealer_profiles where user_id=r.dealer_user_id and published) or exists(select 1 from public.member_status where user_id=r.dealer_user_id and suspended) then raise exception 'このディーラーにはオファーできません。'; end if;
  if p_dates is null or cardinality(p_dates) < 1 or cardinality(p_dates) > 14 then raise exception '頼む日を1〜14日選んでください。'; end if;
  if p_start is null or p_end is null or p_start = p_end then raise exception '開始時間と終了時間を入力してください。'; end if;
  select * into j from public.spot_jobs where id = r.spot_job_id;
  if not found then raise exception 'このチャットの条件が見つかりません。'; end if;
  select * into t from public.dealer_chat_terms where record_id = p_record;
  v_wage := coalesce((r.job_snapshot->>'hourly_wage')::integer, 0);
  if v_wage < 1 then raise exception '時給の記録がありません。ディーラー詳細からオファーしてください。'; end if;

  select array_agg(distinct x order by x) into p_dates from unnest(p_dates) x;
  foreach d in array p_dates loop
    if d < v_today then raise exception '過ぎた日は選べません。'; end if;
    if ((d + p_start) at time zone 'Asia/Tokyo') <= now() then raise exception '勤務開始前の日を選んでください。'; end if;
    if exists(select 1 from public.dealer_matching_records x where x.store_id=r.store_id and x.dealer_user_id=r.dealer_user_id and x.work_start=((d + p_start) at time zone 'Asia/Tokyo') and x.status in ('pending','confirmed')) then
      raise exception '%は、すでにこのディーラーへオファーしています。', to_char(d,'MM/DD');
    end if;
  end loop;

  -- 回数が足りるか先に確かめる(プランの残り＋購入したスカウト)
  v_need := cardinality(p_dates);
  select true, ap.spot_monthly_limit into v_has, v_limit from private.active_store_plan(r.store_id) ap;
  if not (coalesce(v_has,false) and v_limit is null) then
    v_left := case when coalesce(v_has,false) and v_limit > 0 then greatest(0, v_limit - (select count(*) from public.store_quota_uses where store_id=r.store_id and source='plan' and created_at >= (date_trunc('month', now() at time zone 'Asia/Tokyo')) at time zone 'Asia/Tokyo')) else 0 end;
    select coalesce(balance,0) into v_credit from public.store_scout_credits where store_id=r.store_id;
    if v_left + coalesce(v_credit,0) < v_need then
      raise exception 'ディーラースカウトが%回分足りません（%日分のオファーに%回必要です）。「プラン・お支払い」から追加してください。', v_need - v_left - coalesce(v_credit,0), v_need, v_need;
    end if;
  end if;

  select name into v_name from public.stores where id=r.store_id;
  select full_name into v_dealer from public.dealer_profiles where user_id=r.dealer_user_id;
  foreach d in array p_dates loop
    v_start := (d + p_start) at time zone 'Asia/Tokyo';
    v_end := ((d + case when p_end <= p_start then 1 else 0 end) + p_end) at time zone 'Asia/Tokyo';
    insert into public.spot_jobs(store_id,games,duties,requirements,transport_type,transport_limit,dress,deadline,published,scout_only,contract_type,payment_method,payment_date,contract_notes)
    values (r.store_id,j.games,j.duties,j.requirements,j.transport_type,j.transport_limit,j.dress,v_start,false,true,
            coalesce(t.contract_type,j.contract_type),coalesce(t.payment_method,j.payment_method),coalesce(t.payment_date,j.payment_date),coalesce(nullif(t.notes,''),j.contract_notes,'なし'))
    returning id into v_job;
    insert into public.spot_job_shifts(job_id,work_date,start_time,end_time,break_minutes,hourly_wage,headcount) values (v_job,d,p_start,p_end,0,v_wage,1);
    insert into public.dealer_matching_records(store_id,dealer_user_id,work_start,work_end,spot_job_id,job_snapshot)
    values(r.store_id,r.dealer_user_id,v_start,v_end,v_job,jsonb_build_object('store_name',v_name,'dealer_name',v_dealer,'games',j.games,'duties',j.duties,'requirements',j.requirements,'transport_type',j.transport_type,'transport_limit',j.transport_limit,'dress',j.dress,'hourly_wage',v_wage,'headcount',1,'source','store_offer','from_record',p_record))
    returning id into v_id;
    v_ids := v_ids || v_id;
  end loop;
  -- 元のチャットにも残す
  insert into public.dealer_chat_messages(record_id, sender_id, body, nonce)
  values (p_record, auth.uid(), '【追加のオファー】' || (select string_agg(to_char(x,'MM/DD'), '・' order by x) from unnest(p_dates) x) || ' の勤務もお願いしました（' || to_char(p_start,'HH24:MI') || '〜' || to_char(p_end,'HH24:MI') || '）。日ごとのチャットで条件を確認してください。', gen_random_uuid());
  return v_ids;
end $$;
revoke all on function public.offer_more_days(uuid,date[],time,time) from public, anon;
grant execute on function public.offer_more_days(uuid,date[],time,time) to authenticated;
