begin;
-- Preserve the private elevated reader and invoker-only API wrapper.
create or replace function poker_private.poker_statistics(p_admin boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); payload jsonb;
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required'; end if;
 if p_admin and not coalesce(public.is_admin(),false) then raise exception 'Admin required'; end if;
 with finishes as (
 select f.tournament_id,t.title,f.finished_at,x as row
 from poker_private.tournament_finishes f join public.poker_tournaments t on t.id=f.tournament_id cross join lateral jsonb_array_elements(f.standings) x
 ), totals as (
 select row->>'memberId' member_id,max(row->>'name') name,count(*) played,
 count(*) filter(where (row->>'place')::integer=1) firsts,
 count(*) filter(where (row->>'place')::integer=2) seconds,
 count(*) filter(where (row->>'place')::integer=3) thirds from finishes group by row->>'memberId'
 ), rings as (
 select member_id,available,in_play,available+in_play total,updated_at,rank() over(order by available+in_play desc) position from poker_private.ring_accounts
 )
 select jsonb_build_object('asOf',now(),
 'players',coalesce((select jsonb_agg(to_jsonb(q)) from (select * from totals where p_admin or member_id=who::text order by firsts desc,seconds desc,thirds desc,member_id limit 500) q),'[]'::jsonb),
 'history',coalesce((select jsonb_agg(to_jsonb(q)) from (select tournament_id,title,finished_at,row from finishes where p_admin or row->>'memberId'=who::text order by finished_at desc,tournament_id limit 500) q),'[]'::jsonb),
 'ring',coalesce((select jsonb_agg(to_jsonb(q)) from (select r.*,coalesce(nullif(u.raw_user_meta_data->>'display_name',''),'会員') name from rings r join auth.users u on u.id=r.member_id where p_admin or r.member_id=who order by position,r.member_id limit 500) q),'[]'::jsonb),
 'upcoming',coalesce((select jsonb_agg(to_jsonb(q)) from (select t.id,t.title,t.starts_at,a.room_id from poker_private.tournament_registrations reg join public.poker_tournaments t on t.id=reg.tournament_id left join poker_private.room_admissions a on a.tournament_id=t.id and a.member_id=reg.member_id where t.deleted_at is null and reg.member_id=who and not exists(select 1 from poker_private.tournament_finishes f where f.tournament_id=t.id) order by t.starts_at limit 100) q),'[]'::jsonb)) into payload;
 return payload;
end;
$$;
create or replace function public.poker_statistics(p_admin boolean default false) returns jsonb
language sql security invoker set search_path='' as $$select poker_private.poker_statistics(p_admin);$$;
revoke all on function public.poker_statistics(boolean),poker_private.poker_statistics(boolean) from public,anon;
grant execute on function public.poker_statistics(boolean),poker_private.poker_statistics(boolean) to authenticated;
commit;
