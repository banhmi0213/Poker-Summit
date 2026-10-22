-- 前日・先週・先月・前年と比べた上げ下げ(2026/10/22 オーナー指示)。
-- 公平に比べるため「今の期間の始まり〜今」と「前の期間の始まり〜同じ経過時間」を比べる(例: 今日0時〜今 と 昨日0時〜昨日の同じ時刻)。
-- 前の期間が記録を取り始める前(PV・UUは2026/10/21 16時台から)なら、比べられないとして返す。
create or replace function public.admin_compare_periods()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_now timestamptz := now();
  v_jst timestamp := now() at time zone 'Asia/Tokyo';
  v_site_start timestamptz := (select min(created_at) from public.site_page_views);
  v_store_start timestamptz := coalesce((select min(created_at) from public.page_views where visitor_id is not null), now());
  res jsonb := '{}'::jsonb;
  p record; cur_s timestamptz; prev_s timestamptz; prev_e timestamptz;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  for p in select * from (values
      ('day',   date_trunc('day', v_jst), interval '1 day'),
      ('week',  date_trunc('week', v_jst), interval '7 days'),
      ('month', date_trunc('month', v_jst), interval '1 month'),
      ('year',  date_trunc('year', v_jst), interval '1 year')) as t(k, s, step) loop
    cur_s := p.s at time zone 'Asia/Tokyo';
    prev_s := (p.s - p.step) at time zone 'Asia/Tokyo';
    prev_e := prev_s + (v_now - cur_s);
    res := res || jsonb_build_object(p.k, jsonb_build_object(
      'site_pv', jsonb_build_object('cur', (select count(*) from site_page_views where created_at >= cur_s), 'prev', (select count(*) from site_page_views where created_at >= prev_s and created_at < prev_e), 'ok', v_site_start is not null and prev_s >= v_site_start),
      'site_uu', jsonb_build_object('cur', (select count(distinct visitor_id) from site_page_views where created_at >= cur_s), 'prev', (select count(distinct visitor_id) from site_page_views where created_at >= prev_s and created_at < prev_e), 'ok', v_site_start is not null and prev_s >= v_site_start),
      'store_pv', jsonb_build_object('cur', (select count(*) from page_views where store_id is not null and created_at >= cur_s), 'prev', (select count(*) from page_views where store_id is not null and created_at >= prev_s and created_at < prev_e), 'ok', true),
      'store_uu', jsonb_build_object('cur', (select count(distinct visitor_id) from page_views where store_id is not null and created_at >= cur_s), 'prev', (select count(distinct visitor_id) from page_views where store_id is not null and created_at >= prev_s and created_at < prev_e), 'ok', prev_s >= v_store_start),
      'members', jsonb_build_object(
        'cur', (select count(*) from auth.users where created_at >= cur_s and email_confirmed_at is not null and coalesce(email,'') not ilike '%@login.poker-summit.jp' and coalesce(email,'') not ilike '%@withdrawn.invalid'),
        'prev', (select count(*) from auth.users where created_at >= prev_s and created_at < prev_e and email_confirmed_at is not null and coalesce(email,'') not ilike '%@login.poker-summit.jp' and coalesce(email,'') not ilike '%@withdrawn.invalid'),
        'ok', true)
    ));
  end loop;
  return res;
end $$;
revoke all on function public.admin_compare_periods() from public, anon;
grant execute on function public.admin_compare_periods() to authenticated;
