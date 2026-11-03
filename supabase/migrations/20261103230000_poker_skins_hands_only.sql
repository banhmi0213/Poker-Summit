-- 着せ替えはハンド数だけで手に入れる（オーナー 2026/11/03：チップは毎月リセットやから交換は難しい）。
-- テーブル・カードの着せ替えはチップ交換所から外す（値段なし＝交換所に出ず、交換もできない）。
-- 最初に1つずつ無料（テーブル・カードの表・カードの裏）はそのまま。残りはリングのハンド数の節目で1つずつ：
--   トランプ（カードの表・裏）… 100・300・600・1,000・1,500ハンド
--   テーブル … 2,000・3,000・5,000ハンド
-- 着せ替えは全部で8種類（トランプ5・テーブル3）なので、最初に選ばなくても節目だけで全部そろう。
update poker_private.shop_items set price=null where kind='skin' and price is not null;

create or replace function poker_private.skin_is_table(p_item text) returns boolean language sql immutable set search_path to '' as $$select p_item like 'table\_%'$$;

create or replace function poker_private.skin_status_for(p_member uuid) returns jsonb
language plpgsql stable security definer set search_path to '' as $function$
declare hands integer:=poker_private.skin_hands(p_member);
 card_steps integer[]:=array[100,300,600,1000,1500];table_steps integer[]:=array[2000,3000,5000];
 card_earned integer;table_earned integer;card_used integer;table_used integer;
begin
 select count(*)::integer into card_earned from unnest(card_steps) m where hands>=m;
 select count(*)::integer into table_earned from unnest(table_steps) m where hands>=m;
 select count(*) filter (where not poker_private.skin_is_table(item))::integer,count(*) filter (where poker_private.skin_is_table(item))::integer
   into card_used,table_used from poker_private.skin_grants where member_id=p_member and source='milestone';
 return jsonb_build_object(
  'starterDone',exists(select 1 from poker_private.skin_starter_claims where member_id=p_member),
  'hands',hands,'milestones',to_jsonb(card_steps||table_steps),
  'cardMilestones',to_jsonb(card_steps),'tableMilestones',to_jsonb(table_steps),
  'cardPicksEarned',card_earned,'cardPicksUsed',card_used,'tablePicksEarned',table_earned,'tablePicksUsed',table_used,
  'picksEarned',card_earned+table_earned,'picksUsed',card_used+table_used,
  'owned',coalesce((select jsonb_agg(t.item order by t.item) from poker_private.member_tickets t join poker_private.shop_items i on i.code=t.item and i.kind='skin' where t.member_id=p_member and t.count>0),'[]'::jsonb));
end;$function$;

create or replace function public.poker_skin_milestone_claim(p_item text, p_request uuid) returns jsonb
language plpgsql security definer set search_path to '' as $function$
declare who uuid:=auth.uid();s jsonb;prior poker_private.skin_grants%rowtype;tbl boolean;
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required';end if;
 if p_item is null or p_request is null then raise exception 'Invalid skin';end if;
 perform pg_advisory_xact_lock(hashtextextended('skin:'||who::text,0));
 select * into prior from poker_private.skin_grants where member_id=who and request_id=p_request;
 if found then
  if prior.item<>p_item then raise exception 'Request conflict';end if;
  return poker_private.skin_status_for(who);
 end if;
 if not exists(select 1 from poker_private.shop_items where code=p_item and kind='skin' and active) then raise exception 'Invalid skin';end if;
 if exists(select 1 from poker_private.member_tickets where member_id=who and item=p_item and count>0) then raise exception 'Already owned';end if;
 s:=poker_private.skin_status_for(who);tbl:=poker_private.skin_is_table(p_item);
 if tbl and (s->>'tablePicksEarned')::integer<=(s->>'tablePicksUsed')::integer then raise exception 'No picks left';end if;
 if not tbl and (s->>'cardPicksEarned')::integer<=(s->>'cardPicksUsed')::integer then raise exception 'No picks left';end if;
 perform poker_private.skin_grant(who,p_item,'milestone',p_request);
 return poker_private.skin_status_for(who);
end;$function$;
