begin;
-- 収支グラフにGTOとの差を重ねる(オーナー 2026/11/01)。各点に4つ目として、そのハンドまでのEV損失(BB)の累計を足す。
-- EV損失は弱点分析と同じ public.poker_gto_decisions(source='ring'、ref=ハンドID)から、自分の行だけを数える。
create or replace function public.poker_ring_bb_curve() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=auth.uid(); total integer;
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required';end if;
 select count(*) into total from poker_private.hand_history_members m join poker_private.hand_histories h on h.hand_id=m.hand_id and h.kind='ring' where m.member_id=who and m.bb>0;
 return coalesce((select jsonb_agg(jsonb_build_array(x.n,round(x.cum,1),x.played_at,round(x.ev,1)) order by x.n) from (
  select row_number() over(order by m.played_at,m.hand_id)::integer n,sum(m.net::numeric/m.bb) over(order by m.played_at,m.hand_id) cum,m.played_at,
   sum(coalesce(g.loss,0)) over(order by m.played_at,m.hand_id) ev
  from poker_private.hand_history_members m join poker_private.hand_histories h on h.hand_id=m.hand_id and h.kind='ring'
  left join (select d.ref,sum(d.ev_loss)::numeric loss from public.poker_gto_decisions d where d.member_id=who and d.source='ring' and d.ev_loss is not null group by d.ref) g on g.ref=m.hand_id::text
  where m.member_id=who and m.bb>0) x
  where total<=300 or x.n%greatest(1,ceil(total/300.0)::integer)=0 or x.n=total),'[]'::jsonb);
end;$$;
revoke all on function public.poker_ring_bb_curve() from public,anon;
grant execute on function public.poker_ring_bb_curve() to authenticated;
commit;
