-- All existing accounts start at zero only if no wallet exists. Never reset balances.
insert into poker_private.ring_accounts(member_id) select id from auth.users on conflict(member_id) do nothing;
create function poker_private.ring_balance() returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); result jsonb;
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required'; end if;
 insert into poker_private.ring_accounts(member_id) values(who) on conflict(member_id) do nothing;
 select jsonb_build_object('available',a.available,'inPlay',a.in_play,'total',a.available+a.in_play,
  'rank',1+(select count(*) from poker_private.ring_accounts other where other.available+other.in_play>a.available+a.in_play),'asOf',now()) into result
 from poker_private.ring_accounts a where a.member_id=who;
 return result;
end;
$$;
revoke all on function poker_private.ring_balance() from public,anon;
grant execute on function poker_private.ring_balance() to authenticated;
create function public.poker_ring_balance() returns jsonb language sql security invoker set search_path='' as $$select poker_private.ring_balance();$$;
revoke all on function public.poker_ring_balance() from public,anon;
grant execute on function public.poker_ring_balance() to authenticated;
