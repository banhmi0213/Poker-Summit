create schema if not exists poker_display;
revoke all on schema poker_display from public,anon;
grant usage on schema poker_display to authenticated;
create or replace function poker_display.ring_member_profiles(p_table uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or public.is_suspended() is distinct from false then raise exception 'Not authorized'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('seat',r.seat_number,'displayName',left(coalesce(nullif(p.display_name,''),'会員'),80),'avatarUrl',p.avatar_url) order by r.seat_number),'[]'::jsonb)
 from poker_private.ring_fund_reservations r join public.poker_ring_tables t on t.id=r.table_id and t.published and t.deleted_at is null left join public.profiles p on p.user_id=r.member_id where r.table_id=p_table and r.status='seated');
end; $$;
revoke all on function poker_display.ring_member_profiles(uuid) from public,anon;
grant execute on function poker_display.ring_member_profiles(uuid) to authenticated;
create or replace function public.poker_ring_member_profiles(p_table uuid) returns jsonb language sql stable security invoker set search_path='' as $$select poker_display.ring_member_profiles(p_table);$$;
revoke all on function public.poker_ring_member_profiles(uuid) from public,anon;
grant execute on function public.poker_ring_member_profiles(uuid) to authenticated;
