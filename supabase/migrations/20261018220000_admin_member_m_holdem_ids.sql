-- 総合管理の会員管理で m HOLD'EM ID を見るため(2026/10/18)。運営のみ
create or replace function public.admin_member_m_holdem_ids()
returns table(user_id uuid, m_holdem_id text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query
    select u.id, nullif(btrim(u.raw_user_meta_data->>'m_holdem_id'), '')
    from auth.users u
    where nullif(btrim(u.raw_user_meta_data->>'m_holdem_id'), '') is not null;
end;
$$;
revoke all on function public.admin_member_m_holdem_ids() from public, anon;
grant execute on function public.admin_member_m_holdem_ids() to authenticated;

-- 新規会員のまとめメールに m HOLD'EM ID を載せるため。service_role のみ
create or replace function public.member_m_holdem_ids_between(p_since timestamptz, p_until timestamptz)
returns table(email text, m_holdem_id text)
language sql
stable
security definer
set search_path = public
as $$
  select u.email::text, nullif(btrim(u.raw_user_meta_data->>'m_holdem_id'), '')
  from auth.users u
  where u.created_at >= p_since and u.created_at < p_until
    and nullif(btrim(u.raw_user_meta_data->>'m_holdem_id'), '') is not null;
$$;
revoke all on function public.member_m_holdem_ids_between(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.member_m_holdem_ids_between(timestamptz, timestamptz) to service_role;
