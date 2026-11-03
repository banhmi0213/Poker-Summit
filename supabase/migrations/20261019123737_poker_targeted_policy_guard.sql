-- A stale manual management panel must not overwrite a designated-member pool.
alter function public.poker_registration_configure(uuid,integer,boolean) rename to poker_registration_configure_manual;
create function public.poker_registration_configure(p_tournament uuid,p_capacity integer,p_enabled boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from poker_private.entry_settings where tournament_id=p_tournament and automatic) then
  raise exception 'Use designated-member entry settings';
 end if;
 return public.poker_registration_configure_manual(p_tournament,p_capacity,p_enabled);
end;
$$;
revoke all on function public.poker_registration_configure(uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.poker_registration_configure(uuid,integer,boolean) to service_role;
