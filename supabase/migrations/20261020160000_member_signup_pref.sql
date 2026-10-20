-- 登録画面から都道府県を外したかわりに、登録したときの「だいたいの都道府県」を記録する(2026/10/20)。
-- 端末の位置情報で決まった地域(サイトの地域表示で許可した人)があればそれ、なければ回線(IPアドレス)からの推定。
alter table public.member_signup_logs add column if not exists guessed_pref text;
alter table public.member_signup_logs add column if not exists guessed_pref_source text;

-- アクセス統計用: 会員の都道府県の内訳(本人が入れた都道府県を優先し、なければ登録時の推定)。運営のみ。
create or replace function public.member_pref_breakdown()
returns table (pref text, source text, members bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(u.raw_user_meta_data->>'pref', ''), l.guessed_pref, '不明') as pref,
         case when nullif(u.raw_user_meta_data->>'pref', '') is not null then 'self'
              when l.guessed_pref is not null then coalesce(l.guessed_pref_source, 'ip')
              else 'none' end as source,
         count(*) as members
  from auth.users u
  left join public.member_signup_logs l on l.user_id = u.id
  where public.is_admin()
    and u.email not like '%@login.poker-summit.jp'
    and not exists (select 1 from public.admin_users a where a.user_id = u.id)
    and coalesce(u.is_anonymous, false) = false
  group by 1, 2
  order by 3 desc;
$$;
revoke all on function public.member_pref_breakdown() from public, anon;
grant execute on function public.member_pref_breakdown() to authenticated, service_role;
