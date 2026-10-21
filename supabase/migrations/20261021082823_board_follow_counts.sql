-- Aggregate followers without exposing other members' private preferences.
create function private.board_follow_counts(p_post_ids uuid[])
returns table(post_id uuid,total bigint) language sql stable security definer set search_path='' as $$
 select p.id,count(f.user_id) from public.board_posts p
 left join public.board_thread_preferences f on f.post_id=p.id and f.following
 where auth.uid() is not null and not public.is_suspended() and p.status='visible'
 and p.id=any(p_post_ids) group by p.id;
$$;
revoke all on function private.board_follow_counts(uuid[]) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.board_follow_counts(uuid[]) to authenticated;
create function public.board_follow_counts(p_post_ids uuid[])
returns table(post_id uuid,total bigint) language sql stable security invoker set search_path='' as $$
 select * from private.board_follow_counts(p_post_ids);
$$;
revoke all on function public.board_follow_counts(uuid[]) from public,anon;
grant execute on function public.board_follow_counts(uuid[]) to authenticated;
