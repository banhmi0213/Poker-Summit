-- 確定後の勤務キャンセルと、双方の言い分(2026/10/22 オーナー指示)
--  ・確定後のキャンセルだけが対象。合意前(交渉中)にやめたものは記録しない
--  ・キャンセルする側は理由(選択+記述)が必須。勤務開始の3時間前を切ってからは「直前キャンセル」
--  ・キャンセルされた側は、星と言い分を1回だけ書ける
--  ・星の平均には混ぜない。「確定後キャンセル◯回(うち直前◯回)」として別に出す
--  ・運営は中身を見て、回数から外す(cancel_excluded)・言い分を直す・消すことができる
--  ・回数(プランの回数・スカウト)は戻らない
alter table public.dealer_matching_records
  add column if not exists cancel_reason_code text,
  add column if not exists cancel_reason text,
  add column if not exists cancel_late boolean,
  add column if not exists cancel_reply text,
  add column if not exists cancel_reply_rating integer,
  add column if not exists cancel_reply_at timestamptz,
  add column if not exists cancel_excluded boolean not null default false,
  add column if not exists cancel_admin_note text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'dmr_cancel_reply_rating_check') then
    alter table public.dealer_matching_records add constraint dmr_cancel_reply_rating_check check (cancel_reply_rating is null or cancel_reply_rating between 1 and 5);
  end if;
end $$;

create or replace function public.cancel_spot_work(p_record uuid, p_actor text, p_code text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.dealer_matching_records; v_late boolean; v_label text;
begin
  if auth.uid() is null or public.is_suspended() or p_actor not in ('store','dealer') then raise exception '操作できません。'; end if;
  if not exists(select 1 from public.user_legal_consents where user_id=auth.uid() and scope='matching_'||p_actor and terms_version='2026-10-07' and privacy_version='2026-10-07' and rules_version='2026-10-07') then raise exception '規約への同意が必要です。'; end if;
  select * into r from public.dealer_matching_records where id=p_record for update;
  if not found then raise exception '勤務がありません。'; end if;
  if (p_actor='dealer' and r.dealer_user_id<>auth.uid()) or (p_actor='store' and not exists(select 1 from public.stores where id=r.store_id and owner_user_id=auth.uid())) then raise exception 'この勤務は操作できません。'; end if;
  if r.status<>'confirmed' then raise exception '確定している勤務だけキャンセルできます。'; end if;
  if r.work_start<=now() then raise exception '勤務開始時刻を過ぎた勤務はキャンセルできません。運営へお問い合わせください。'; end if;
  v_label := case p_code when 'illness' then '体調不良' when 'urgent' then '急用' when 'store_reason' then '店舗の都合' when 'no_contact' then '相手と連絡が取れない' when 'conditions' then '条件の食い違い' when 'other' then 'その他' end;
  if v_label is null then raise exception 'キャンセルの理由を選んでください。'; end if;
  if length(btrim(coalesce(p_reason,''))) not between 1 and 1000 then raise exception 'キャンセルの理由を1〜1000文字で書いてください。'; end if;
  if p_reason ~* '(@|line|ライン|https?://|www\.|(0|\+)[0-9() -]{8,}[0-9])' then raise exception '理由に連絡先やURLは書けません。'; end if;
  v_late := r.work_start - now() < interval '3 hours';
  update public.dealer_matching_records set
    status = case when p_actor='store' then 'store_cancelled' else 'dealer_cancelled' end,
    outcome_at = now(), cancellation_notice_at = now(),
    cancel_reason_code = p_code, cancel_reason = btrim(p_reason), cancel_late = v_late
  where id = p_record;
  -- 相手に知らせる(チャットに残り、通知も届く)
  insert into public.dealer_chat_messages(record_id, sender_id, body, nonce)
  values (p_record, auth.uid(), left('【勤務キャンセル】' || case when p_actor='store' then '店舗' else 'ディーラー' end || 'がこの勤務をキャンセルしました' || case when v_late then '（勤務開始3時間前以降の直前キャンセル）' else '' end || E'\n理由：' || v_label || E'\n' || btrim(p_reason), 2000), gen_random_uuid());
end $$;
revoke all on function public.cancel_spot_work(uuid,text,text,text) from public, anon;
grant execute on function public.cancel_spot_work(uuid,text,text,text) to authenticated;

-- キャンセルされた側の言い分と星(1回だけ・30日以内)
create or replace function public.reply_spot_cancel(p_record uuid, p_actor text, p_rating integer, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.dealer_matching_records;
begin
  if auth.uid() is null or public.is_suspended() or p_actor not in ('store','dealer') then raise exception '操作できません。'; end if;
  select * into r from public.dealer_matching_records where id=p_record for update;
  if not found then raise exception '勤務がありません。'; end if;
  if (p_actor='dealer' and r.dealer_user_id<>auth.uid()) or (p_actor='store' and not exists(select 1 from public.stores where id=r.store_id and owner_user_id=auth.uid())) then raise exception 'この勤務は操作できません。'; end if;
  if not ((p_actor='store' and r.status='dealer_cancelled') or (p_actor='dealer' and r.status='store_cancelled')) then raise exception '相手がキャンセルした勤務にだけ書けます。'; end if;
  if r.cancel_reply_at is not null then raise exception 'すでに書いています。'; end if;
  if r.cancellation_notice_at < now() - interval '30 days' then raise exception 'キャンセルから30日を過ぎたため書けません。'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception '星評価を1〜5で選んでください。'; end if;
  if length(btrim(coalesce(p_comment,''))) not between 1 and 1000 then raise exception '1〜1000文字で書いてください。'; end if;
  if p_comment ~* '(@|line|ライン|https?://|www\.|(0|\+)[0-9() -]{8,}[0-9])' then raise exception '連絡先やURLは書けません。'; end if;
  update public.dealer_matching_records set cancel_reply=btrim(p_comment), cancel_reply_rating=p_rating, cancel_reply_at=now() where id=p_record;
end $$;
revoke all on function public.reply_spot_cancel(uuid,text,integer,text) from public, anon;
grant execute on function public.reply_spot_cancel(uuid,text,integer,text) to authenticated;

-- キャンセルの記録(ディーラーの分は店舗が、店舗の分はディーラーが見られる)。運営が外したものは数えない
create or replace function public.get_cancellation_history(p_dealer uuid default null, p_store uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_items jsonb; v_count integer; v_late integer;
begin
  if auth.uid() is null or public.is_suspended() then raise exception '閲覧できません。'; end if;
  if (p_dealer is null) = (p_store is null) then raise exception '対象を確認してください。'; end if;
  if p_dealer is not null and not (public.is_admin() or p_dealer = auth.uid() or exists(select 1 from public.stores where owner_user_id=auth.uid())) then raise exception '閲覧できません。'; end if;
  if p_store is not null and not (public.is_admin() or exists(select 1 from public.stores where id=p_store and owner_user_id=auth.uid()) or exists(select 1 from public.dealer_profiles where user_id=auth.uid())) then raise exception '閲覧できません。'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('work_start',c.work_start,'cancelled_at',c.cancellation_notice_at,'late',c.cancel_late,'reason_code',c.cancel_reason_code,'reason',c.cancel_reason,
      'reply',c.cancel_reply,'reply_rating',c.cancel_reply_rating,'reply_at',c.cancel_reply_at,'store_name',c.job_snapshot->>'store_name') order by c.cancellation_notice_at desc), '[]'::jsonb)
  into v_items
  from (select r.* from public.dealer_matching_records r
    where not r.cancel_excluded and r.cancellation_notice_at is not null and r.cancel_reason is not null
      and ((p_dealer is not null and r.status='dealer_cancelled' and r.dealer_user_id = any(private.dealer_identity_ids(p_dealer)))
        or (p_store is not null and r.status='store_cancelled' and r.store_id = p_store))
    order by r.cancellation_notice_at desc limit 20) c;
  select count(*), count(*) filter (where cancel_late) into v_count, v_late from public.dealer_matching_records r
    where not r.cancel_excluded and r.cancellation_notice_at is not null and r.cancel_reason is not null
      and ((p_dealer is not null and r.status='dealer_cancelled' and r.dealer_user_id = any(private.dealer_identity_ids(p_dealer)))
        or (p_store is not null and r.status='store_cancelled' and r.store_id = p_store));
  return jsonb_build_object('count', v_count, 'late', v_late, 'items', v_items);
end $$;
revoke all on function public.get_cancellation_history(uuid,uuid) from public, anon;
grant execute on function public.get_cancellation_history(uuid,uuid) to authenticated;

-- 勤務実績(キャンセル率)からも、運営が外したキャンセルは除く
CREATE OR REPLACE FUNCTION public.get_dealer_reliability(p_dealer_ids uuid[])
 RETURNS TABLE(dealer_user_id uuid, total bigint, completed bigint, cancellations bigint, no_shows bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or public.is_suspended() then raise exception '閲覧できません。'; end if;
 if p_dealer_ids is null or cardinality(p_dealer_ids)>500 then raise exception '対象を確認してください。'; end if;
 if not exists(select 1 from public.stores where owner_user_id=auth.uid()) and (cardinality(p_dealer_ids)<>1 or p_dealer_ids[1]<>auth.uid()) then raise exception '本人または店舗アカウントのみ閲覧できます。'; end if;
 return query select d.user_id,count(r.id),count(r.id) filter(where r.status='completed'),count(r.id) filter(where r.status in ('dealer_cancelled','no_show_verified')),count(r.id) filter(where r.status='no_show_verified')
 from public.dealer_profiles d left join public.dealer_matching_records r on r.dealer_user_id = any(private.dealer_identity_ids(d.user_id)) and r.store_confirmed_at is not null and r.dealer_confirmed_at is not null and r.outcome_at<=now() and not r.cancel_excluded and ((r.status='completed' and r.work_end<=now()) or r.status='dealer_cancelled' or (r.status='no_show_verified' and r.work_start<=now() and r.verified_at<=now()))
 where d.user_id=any(p_dealer_ids) and (d.user_id=auth.uid() or (d.published and exists(select 1 from public.stores where owner_user_id=auth.uid()))) group by d.user_id;
end;
$function$;
