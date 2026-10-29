-- Prepared only. Backend lookup receives a verified member UUID; no browser RPC grants.
create index room_admissions_member on poker_private.room_admissions(member_id,tournament_id);
create function public.poker_room_assignments(p_member uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('roomId',r.room_id,'tournamentId',r.tournament_id,
   'title',left(t.title,200),'starts_at',r.starts_at,'capacity',r.capacity,'published',t.published)
   order by r.starts_at,r.room_id),'[]'::jsonb)
 from (
   select a.room_id,a.tournament_id from poker_private.room_admissions a
   join poker_private.tournament_rooms r on r.room_id=a.room_id
   where a.member_id=p_member and r.enabled
   order by r.starts_at,r.room_id limit 65
 ) a join poker_private.tournament_rooms r on r.room_id=a.room_id
 join public.poker_tournaments t on t.id=r.tournament_id;
$$;
revoke all on function public.poker_room_assignments(uuid) from public,anon,authenticated;
grant execute on function public.poker_room_assignments(uuid) to service_role;
