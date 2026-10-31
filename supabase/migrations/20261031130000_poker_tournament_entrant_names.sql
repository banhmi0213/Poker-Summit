-- 大会の順位一覧に出す表示名(オーナー 2026/10/31：トナメは順位が一覧でわかるように)。
-- 卓の画面には会員IDを出さず entry id(e-1…)だけを送る。e-N は参加者の会員IDを文字列で並べたN番目(lib/poker/tournament-field.ts)。
-- ここで同じ並びの表示名を返す。ログイン中の会員(停止中は除く)だけが読める。
create or replace function poker_display.tournament_entrant_names(p_room uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if who is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or public.is_suspended() is distinct from false then raise exception 'Not authorized'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('entry','e-'||x.n,'displayName',left(coalesce(nullif(p.display_name,''),'会員'),80),'you',x.member_id=who) order by x.n),'[]'::jsonb)
  from (select a.member_id,row_number() over(order by a.member_id::text collate "C") n from poker_private.room_admissions a where a.room_id=p_room) x
  left join public.profiles p on p.user_id=x.member_id);
end; $$;
revoke all on function poker_display.tournament_entrant_names(uuid) from public,anon;
grant execute on function poker_display.tournament_entrant_names(uuid) to authenticated;

create or replace function public.poker_tournament_entrant_names(p_room uuid)
returns jsonb language sql stable set search_path='' as $$select poker_display.tournament_entrant_names(p_room);$$;
revoke all on function public.poker_tournament_entrant_names(uuid) from public,anon;
grant execute on function public.poker_tournament_entrant_names(uuid) to authenticated;
