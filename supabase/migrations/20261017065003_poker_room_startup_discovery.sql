-- Prepared only: trusted startup discovery. No browser execution or plaintext state.
create index tournament_rooms_enabled_startup on poker_private.tournament_rooms(room_id) where enabled;

create function public.poker_room_startup_ids(p_limit integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_limit is null or p_limit<1 or p_limit>10000 then raise exception 'Invalid startup limit'; end if;
 -- Read one extra ID so the owner cannot silently omit rooms at its capacity.
 -- Include unpublished/finished rooms: ongoing continuity and saved results
 -- must not depend on current publication or an untrusted plaintext shortcut.
 select coalesce(jsonb_agg(room_id order by room_id),'[]'::jsonb) into result
 from (select room_id from poker_private.tournament_rooms where enabled
       order by room_id limit p_limit+1) rooms;
 return result;
end;
$$;
revoke all on function public.poker_room_startup_ids(integer) from public,anon,authenticated;
grant execute on function public.poker_room_startup_ids(integer) to service_role;
