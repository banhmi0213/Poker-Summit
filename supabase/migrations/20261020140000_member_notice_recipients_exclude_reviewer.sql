-- 会員へのお知らせメールから、KOMOJUの審査用アカウントを外す(2026/10/20 オーナー指示)
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
    and lower(u.email) <> 'support-jp@komoju.com'
    and not exists (select 1 from public.admin_users a where a.user_id = u.id)
    and coalesce(u.is_anonymous, false) = false
  order by u.created_at;
$$;
