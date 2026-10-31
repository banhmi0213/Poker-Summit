-- 着せ替えの入手方法(オーナー 2026/10/31)。
--  1) はじめに 卓・カードの表・カードの裏 を1つずつ無料で選ぶ(1回だけ。標準を選んだ分は付与なし)。
--  2) それ以外は チップ交換所で交換、または リングのハンド数の特典(100・500・1,500・3,000ハンドごとに好きな1つを無料)。
-- 持っている扱いは交換所と同じ member_tickets(count 1、減らない)。課金はまだ作らない。
create table if not exists poker_private.skin_grants(
 member_id uuid not null,
 item text not null references poker_private.shop_items(code),
 source text not null check(source in('starter','milestone')),
 request_id uuid,
 created_at timestamptz not null default now(),
 primary key(member_id,item)
);
create unique index if not exists skin_grants_request on poker_private.skin_grants(member_id,request_id) where request_id is not null;
create table if not exists poker_private.skin_starter_claims(
 member_id uuid primary key,
 table_item text,face_item text,back_item text,
 created_at timestamptz not null default now()
);
alter table poker_private.skin_grants enable row level security;
alter table poker_private.skin_starter_claims enable row level security;
revoke all on poker_private.skin_grants,poker_private.skin_starter_claims from public,anon,authenticated;
grant select on poker_private.skin_grants,poker_private.skin_starter_claims to service_role;

-- Ring hands this member has played (one settlement row per participant per hand).
create or replace function poker_private.skin_hands(p_member uuid) returns integer language sql stable security definer set search_path='' as $$
 select count(*)::integer from poker_private.ring_chip_ledger where member_id=p_member and kind='settlement';
$$;
revoke all on function poker_private.skin_hands(uuid) from public,anon,authenticated,service_role;

create or replace function poker_private.skin_status_for(p_member uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare hands integer:=poker_private.skin_hands(p_member);earned integer;used integer;
begin
 select count(*)::integer into earned from unnest(array[100,500,1500,3000]) m where hands>=m;
 select count(*)::integer into used from poker_private.skin_grants where member_id=p_member and source='milestone';
 return jsonb_build_object(
  'starterDone',exists(select 1 from poker_private.skin_starter_claims where member_id=p_member),
  'hands',hands,'milestones',jsonb_build_array(100,500,1500,3000),
  'picksEarned',earned,'picksUsed',used,
  'owned',coalesce((select jsonb_agg(t.item order by t.item) from poker_private.member_tickets t join poker_private.shop_items i on i.code=t.item and i.kind='skin' where t.member_id=p_member and t.count>0),'[]'::jsonb));
end;$$;
revoke all on function poker_private.skin_status_for(uuid) from public,anon,authenticated,service_role;

create or replace function public.poker_skin_status() returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required';end if;
 return poker_private.skin_status_for(who);
end;$$;
revoke all on function public.poker_skin_status() from public,anon,service_role;
grant execute on function public.poker_skin_status() to authenticated;

-- One skin item: must be an active skin whose code starts with the given prefix (null = standard, nothing to grant).
create or replace function poker_private.skin_check(p_item text,p_prefix text) returns boolean language sql stable security definer set search_path='' as $$
 select p_item is null or exists(select 1 from poker_private.shop_items where code=p_item and kind='skin' and active and starts_with(code,p_prefix));
$$;
revoke all on function poker_private.skin_check(text,text) from public,anon,authenticated,service_role;

create or replace function poker_private.skin_grant(p_member uuid,p_item text,p_source text,p_request uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into poker_private.skin_grants(member_id,item,source,request_id) values(p_member,p_item,p_source,p_request);
 insert into poker_private.member_tickets(member_id,item,count) values(p_member,p_item,1)
  on conflict (member_id,item) do update set count=greatest(poker_private.member_tickets.count,1),updated_at=now();
end;$$;
revoke all on function poker_private.skin_grant(uuid,text,text,uuid) from public,anon,authenticated,service_role;

-- The first free picks: once per member. Items already owned are simply kept.
create or replace function public.poker_skin_starter(p_table text,p_face text,p_back text) returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();it text;
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required';end if;
 if not poker_private.skin_check(p_table,'table_') or not poker_private.skin_check(p_face,'card_front_') or not poker_private.skin_check(p_back,'card_back_') then raise exception 'Invalid skin';end if;
 insert into poker_private.skin_starter_claims(member_id,table_item,face_item,back_item) values(who,p_table,p_face,p_back) on conflict do nothing;
 if not found then raise exception 'Starter already chosen';end if;
 foreach it in array array_remove(array[p_table,p_face,p_back],null) loop
  if not exists(select 1 from poker_private.member_tickets where member_id=who and item=it and count>0) then perform poker_private.skin_grant(who,it,'starter',null);end if;
 end loop;
 return poker_private.skin_status_for(who);
end;$$;
revoke all on function public.poker_skin_starter(text,text,text) from public,anon,service_role;
grant execute on function public.poker_skin_starter(text,text,text) to authenticated;

-- A hand-count pick: any skin not owned yet, while picks remain. A retried request returns the same result.
create or replace function public.poker_skin_milestone_claim(p_item text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();s jsonb;prior poker_private.skin_grants%rowtype;
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required';end if;
 if p_item is null or p_request is null then raise exception 'Invalid skin';end if;
 -- Serialize this member's claims.
 perform pg_advisory_xact_lock(hashtextextended('skin:'||who::text,0));
 select * into prior from poker_private.skin_grants where member_id=who and request_id=p_request;
 if found then
  if prior.item<>p_item then raise exception 'Request conflict';end if;
  return poker_private.skin_status_for(who);
 end if;
 if not exists(select 1 from poker_private.shop_items where code=p_item and kind='skin' and active) then raise exception 'Invalid skin';end if;
 if exists(select 1 from poker_private.member_tickets where member_id=who and item=p_item and count>0) then raise exception 'Already owned';end if;
 s:=poker_private.skin_status_for(who);
 if (s->>'picksEarned')::integer<=(s->>'picksUsed')::integer then raise exception 'No picks left';end if;
 perform poker_private.skin_grant(who,p_item,'milestone',p_request);
 return poker_private.skin_status_for(who);
end;$$;
revoke all on function public.poker_skin_milestone_claim(text,uuid) from public,anon,service_role;
grant execute on function public.poker_skin_milestone_claim(text,uuid) to authenticated;
