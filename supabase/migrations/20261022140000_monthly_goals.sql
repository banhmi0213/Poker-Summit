-- 今月の目標と進み具合(2026/10/22 オーナー指示)。目標は運営が管理画面で変えられる。
alter table public.site_settings add column if not exists monthly_goals jsonb not null
  default '{"pv":20000,"uu":5000,"members":300,"dealers":30,"paid_stores":5}'::jsonb;

-- 今月の実績(日本時間の月初から)。ディーラー・有料店舗は今の数(累計)
create or replace function public.admin_month_progress()
returns json language plpgsql stable security definer set search_path = public as $$
declare v_start timestamptz := (date_trunc('month', now() at time zone 'Asia/Tokyo')) at time zone 'Asia/Tokyo';
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return json_build_object(
    'month_start', v_start,
    'pv', (select count(*) from public.site_page_views where created_at >= v_start),
    'uu', (select count(distinct visitor_id) from public.site_page_views where created_at >= v_start and visitor_id is not null),
    'members', (select count(*) from auth.users where created_at >= v_start and email_confirmed_at is not null
                  and coalesce(email,'') not ilike '%@login.poker-summit.jp' and coalesce(email,'') not ilike '%@withdrawn.invalid'),
    'dealers', (select count(*) from public.dealer_profiles where published),
    'paid_stores', (select count(distinct c.store_id) from public.store_contracts c join public.stores s on s.id=c.store_id where c.status='active' and s.status<>'test')
  );
end $$;
revoke all on function public.admin_month_progress() from public, anon;
grant execute on function public.admin_month_progress() to authenticated;
