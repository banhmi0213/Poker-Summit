-- スポット求人は勤務日1日で1回(2026/10/22 オーナー指示)。3日分の求人なら3回。
-- オファー(スカウト)はディーラー1人・勤務日1日で1回(変更なし)。オファーの勤務日は今日以降ならいつでも。
alter table public.store_quota_uses add column if not exists ref_date date;
alter table public.store_quota_uses drop constraint if exists store_quota_uses_kind_ref_id_key;
create unique index if not exists store_quota_uses_unique_ref on public.store_quota_uses (kind, ref_id, coalesce(ref_date, date '1900-01-01'));

-- 公開中のスポット求人の勤務日1日分の回数を使う(同じ求人・同じ日は1回だけ)
create or replace function private.use_spot_day(p_job uuid, p_store uuid, p_date date)
returns void language plpgsql security definer set search_path = public as $$
declare v_src text;
begin
  if exists (select 1 from public.store_quota_uses where kind = 'spot' and ref_id = p_job and ref_date = p_date) then return; end if;
  v_src := private.use_plan_quota(p_store);
  if v_src is null then
    if private.use_spot_credit(p_store) then v_src := 'credit';
    else
      raise exception 'スポット求人の回数が足りません（勤務日1日につき1回）。今月の回数を使い切った場合やライトプランでは、「スポット求人1日分」を追加すると公開できます。';
    end if;
  end if;
  insert into public.store_quota_uses(store_id, kind, ref_id, ref_date, source) values (p_store, 'spot', p_job, p_date, v_src);
end $$;

create or replace function private.enforce_spot_publish()
returns trigger language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if not new.published or new.scout_only then return new; end if;
  if public.is_admin() then return new; end if;
  if tg_op = 'UPDATE' and old.published then return new; end if;
  -- 公開に切り替えたとき、もう登録されている勤務日の分を使う(新しく入る勤務日は spot_job_shifts のトリガーで使う)
  if tg_op = 'UPDATE' then
    for s in select work_date from public.spot_job_shifts where job_id = new.id loop
      perform private.use_spot_day(new.id, new.store_id, s.work_date);
    end loop;
  end if;
  return new;
end $$;

create or replace function private.enforce_spot_shift_window()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_today date := (now() at time zone 'Asia/Tokyo')::date; j record;
begin
  if public.is_admin() then return new; end if;
  select id, store_id, published, scout_only into j from public.spot_jobs where id = new.job_id;
  if not found or not j.published or j.scout_only then return new; end if;
  if new.work_date < v_today or new.work_date > v_today + 2 then
    raise exception 'スポット求人の勤務日は、今日から2日後までの日を選んでください（公開する場合）。';
  end if;
  perform private.use_spot_day(j.id, j.store_id, new.work_date);
  return new;
end $$;

-- 直接オファーの勤務日は今日以降ならいつでも
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
  if p_date is null or p_date < v_today or p_date > v_today + 365 then raise exception '勤務日を確認してください。'; end if;
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

update public.addons set name='スポット求人1日分', description='スポット求人の勤務日1日分を公開できます（1日分2,200円・税込）。ライトプランでも使え、スタンダードプランの月10回を使い切った後にも使えます。' where code='spot_job_credit';
update public.addons set description='希望条件に合うディーラーに、店舗から直接オファーを送れます。ディーラー1人・勤務日1日につき1回・2,200円（税込）。スタンダードプランの月10回を使い切った後や、ライトプランで使えます。採用・勤務の成立を保証するものではありません。' where code='dealer_scout';
