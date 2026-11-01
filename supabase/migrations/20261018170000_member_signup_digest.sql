-- 新規会員登録の1日1回まとめメール(2026/10/18)。app/api/cron/member-digest/route.ts
alter table public.site_settings add column if not exists notify_member_digest boolean not null default true;

-- 1日1回の新規会員まとめメール用(service_role のみ)。店舗管理ログイン・運営は除く
create or replace function public.member_signup_digest(p_since timestamptz, p_until timestamptz)
returns table(email text, created_at timestamptz, confirmed boolean, total_members bigint)
language sql
stable
security definer
set search_path = public
as $$
  with members as (
    select u.id, u.email::text as email, u.created_at, (u.email_confirmed_at is not null) as confirmed
    from auth.users u
    where u.email not like '%@login.poker-summit.jp'
      and not exists (select 1 from public.admin_users a where a.user_id = u.id)
      and coalesce(u.is_anonymous, false) = false
  )
  select m.email, m.created_at, m.confirmed, (select count(*) from members) as total_members
  from members m
  where m.created_at >= p_since and m.created_at < p_until
  union all
  select null, null, null, (select count(*) from members)
  where not exists (select 1 from members m where m.created_at >= p_since and m.created_at < p_until)
  order by 2 nulls last;
$$;
revoke all on function public.member_signup_digest(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.member_signup_digest(timestamptz, timestamptz) to service_role;
