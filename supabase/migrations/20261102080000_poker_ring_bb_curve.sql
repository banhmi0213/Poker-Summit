begin;
-- 収支グラフ(オーナー 2026/11/01)。自分のリングの通算BBの推移を、最大300点に間引いて返す(実際の勝ち負けそのまま)。
create or replace function public.poker_ring_bb_curve() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=auth.uid(); total integer;
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required';end if;
 select count(*) into total from poker_private.hand_history_members m join poker_private.hand_histories h on h.hand_id=m.hand_id and h.kind='ring' where m.member_id=who and m.bb>0;
 return coalesce((select jsonb_agg(jsonb_build_array(x.n,round(x.cum,1),x.played_at) order by x.n) from (
  select row_number() over(order by m.played_at,m.hand_id)::integer n,sum(m.net::numeric/m.bb) over(order by m.played_at,m.hand_id) cum,m.played_at
  from poker_private.hand_history_members m join poker_private.hand_histories h on h.hand_id=m.hand_id and h.kind='ring' where m.member_id=who and m.bb>0) x
  where total<=300 or x.n%greatest(1,ceil(total/300.0)::integer)=0 or x.n=total),'[]'::jsonb);
end;$$;
revoke all on function public.poker_ring_bb_curve() from public,anon;
grant execute on function public.poker_ring_bb_curve() to authenticated;
commit;
