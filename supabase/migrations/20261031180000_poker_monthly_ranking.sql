-- 「11月 チップ獲得ランキング」(オーナー 2026/10/31：プラスの人だけ、上位3人など)。
-- 今月(日本時間)のリングのハンドの精算の合計がプラスの会員だけを多い順に。表示名と順位と獲得チップだけで、会員IDは出さない。
-- ロビーはログイン前でも見られるので、匿名でも読める。
create or replace function public.poker_ring_monthly_ranking(p_limit integer default 3) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=auth.uid(); m text:=to_char(now() at time zone 'Asia/Tokyo','YYYY-MM'); since timestamptz:=(date_trunc('month',now() at time zone 'Asia/Tokyo')) at time zone 'Asia/Tokyo';
begin
 if p_limit is null or p_limit<1 or p_limit>100 then raise exception 'Invalid limit';end if;
 return jsonb_build_object('month',m,'rows',coalesce((select jsonb_agg(jsonb_build_object('place',r.place,'displayName',left(coalesce(nullif(p.display_name,''),'会員'),80),'avatarUrl',p.avatar_url,'gain',r.gain,'you',who is not null and r.member_id=who) order by r.place,r.gain desc) from (
   select x.member_id,x.gain,rank() over(order by x.gain desc)::integer place from (
    select l.member_id,sum(l.in_play_delta)::bigint gain from poker_private.ring_chip_ledger l join auth.users u on u.id=l.member_id
    where l.kind='settlement' and l.created_at>=since and not coalesce(u.is_anonymous,false) and u.deleted_at is null
      and not exists(select 1 from public.member_status s where s.user_id=l.member_id and s.suspended)
    group by l.member_id) x where x.gain>0 order by x.gain desc limit p_limit) r
  left join public.profiles p on p.user_id=r.member_id),'[]'::jsonb));
end;$$;
revoke all on function public.poker_ring_monthly_ranking(integer) from public;
grant execute on function public.poker_ring_monthly_ranking(integer) to anon,authenticated;
