-- 先行登録ページの効果測定用: 日本時間の日ごとの新規会員数(店舗管理ログイン・運営は除く)。service_role のみ
-- 総合管理 > アクセス統計 > 先行登録 で使う(2026/10/18)
create or replace function public.member_signup_daily(p_since timestamptz)
returns table(day date, signups bigint, confirmed bigint)
language sql
stable
security definer
set search_path = public
as $$
  select (u.created_at at time zone 'Asia/Tokyo')::date as day,
         count(*) as signups,
         count(*) filter (where u.email_confirmed_at is not null) as confirmed
  from auth.users u
  where u.created_at >= p_since
    and u.email not like '%@login.poker-summit.jp'
    and not exists (select 1 from public.admin_users a where a.user_id = u.id)
    and coalesce(u.is_anonymous, false) = false
  group by 1
  order by 1;
$$;
revoke all on function public.member_signup_daily(timestamptz) from public, anon, authenticated;
grant execute on function public.member_signup_daily(timestamptz) to service_role;
