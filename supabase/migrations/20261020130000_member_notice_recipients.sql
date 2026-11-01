-- 会員へのお知らせメールの宛先(2026/10/20)。メール確認済みの会員だけ。店舗管理のログイン・運営アカウントは除く。
create or replace function public.member_notice_recipients()
returns table (email text)
language sql
security definer
set search_path = ''
as $$
  select u.email::text
  from auth.users u
  where u.email is not null
    and u.email_confirmed_at is not null
    and u.email not like '%@login.poker-summit.jp'
    and not exists (select 1 from public.admin_users a where a.user_id = u.id)
    and coalesce(u.is_anonymous, false) = false
  order by u.created_at;
$$;
revoke all on function public.member_notice_recipients() from public, anon, authenticated;
grant execute on function public.member_notice_recipients() to service_role;
