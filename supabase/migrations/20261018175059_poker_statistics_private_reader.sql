-- Keep elevated reads out of PostgREST's public API schema. The private function
-- independently verifies auth.uid(), suspension and admin status on every call.
alter function public.poker_statistics(boolean) set schema poker_private;
grant usage on schema poker_private to authenticated;
revoke all on function poker_private.poker_statistics(boolean) from public,anon;
grant execute on function poker_private.poker_statistics(boolean) to authenticated;
create function public.poker_statistics(p_admin boolean default false) returns jsonb
language sql security invoker set search_path='' as $$
 select poker_private.poker_statistics(p_admin);
$$;
revoke all on function public.poker_statistics(boolean) from public,anon;
grant execute on function public.poker_statistics(boolean) to authenticated;
