-- 会員の見た目(オーナー 2026/11/01)：アイコン枠・ネームプレート・サミットのスレッドデザイン。
-- 見た目だけで、チップ・チケット・勝ち負けには一切関わらない。持っている扱いは着せ替えと同じ member_tickets(count 1)。
-- 販売(KOMOJU)はまだなので価格は null(交換所にも出ない)。販売開始までは cosmetics_free_for_now() が true で、全員が全部を選べる。
-- 選んだもの(member_cosmetics)は他の会員にも見える：リングの卓の会員情報・大会の参加者名・サミットの投稿者。
do $$ begin
 alter table poker_private.shop_items drop constraint if exists shop_items_kind_check;
 alter table poker_private.shop_items add constraint shop_items_kind_check check(kind in('ticket','skin','cosmetic'));
end $$;
-- 仮デザイン(ダニエルさんの正式デザインが届いたら差し替え・追加)。
insert into poker_private.shop_items(code,label,description,price,kind,sort) values
 ('frame_gold','アイコン枠：ゴールド','仮デザイン（正式なデザインに差し替え予定）。ずっと使えます。',null,'cosmetic',100),
 ('frame_silver','アイコン枠：シルバー','仮デザイン（正式なデザインに差し替え予定）。ずっと使えます。',null,'cosmetic',101),
 ('frame_sakura','アイコン枠：桜','仮デザイン（正式なデザインに差し替え予定）。ずっと使えます。',null,'cosmetic',102),
 ('frame_navy','アイコン枠：ネイビー','仮デザイン（正式なデザインに差し替え予定）。ずっと使えます。',null,'cosmetic',103),
 ('plate_gold','ネームプレート：ゴールド','仮デザイン（正式なデザインに差し替え予定）。ずっと使えます。',null,'cosmetic',104),
 ('plate_silver','ネームプレート：シルバー','仮デザイン（正式なデザインに差し替え予定）。ずっと使えます。',null,'cosmetic',105),
 ('plate_sakura','ネームプレート：桜','仮デザイン（正式なデザインに差し替え予定）。ずっと使えます。',null,'cosmetic',106),
 ('plate_navy','ネームプレート：ネイビー','仮デザイン（正式なデザインに差し替え予定）。ずっと使えます。',null,'cosmetic',107),
 ('thread_gold','スレッドデザイン：ゴールド','仮デザイン（正式なデザインに差し替え予定）。ずっと使えます。',null,'cosmetic',108),
 ('thread_silver','スレッドデザイン：シルバー','仮デザイン（正式なデザインに差し替え予定）。ずっと使えます。',null,'cosmetic',109),
 ('thread_sakura','スレッドデザイン：桜','仮デザイン（正式なデザインに差し替え予定）。ずっと使えます。',null,'cosmetic',110),
 ('thread_navy','スレッドデザイン：ネイビー','仮デザイン（正式なデザインに差し替え予定）。ずっと使えます。',null,'cosmetic',111)
on conflict (code) do nothing;

create table if not exists poker_private.member_cosmetics(
 member_id uuid primary key,
 frame text references poker_private.shop_items(code),
 plate text references poker_private.shop_items(code),
 thread text references poker_private.shop_items(code),
 updated_at timestamptz not null default now()
);
alter table poker_private.member_cosmetics enable row level security;
revoke all on poker_private.member_cosmetics from public,anon,authenticated;

-- 販売開始までは true(全員が全部を選べる)。販売開始のときに false に変える。
create or replace function poker_private.cosmetics_free_for_now() returns boolean language sql immutable set search_path='' as $f$ select true $f$;
revoke all on function poker_private.cosmetics_free_for_now() from public,anon,authenticated,service_role;

create or replace function poker_private.cosmetic_ok(p_member uuid,p_item text,p_prefix text) returns boolean language sql stable security definer set search_path='' as $f$
 select p_item is null or (exists(select 1 from poker_private.shop_items where code=p_item and kind='cosmetic' and active and starts_with(code,p_prefix))
  and (poker_private.cosmetics_free_for_now() or exists(select 1 from poker_private.member_tickets where member_id=p_member and item=p_item and count>0)));
$f$;
revoke all on function poker_private.cosmetic_ok(uuid,text,text) from public,anon,authenticated,service_role;

create or replace function poker_private.cosmetics_status_for(p_member uuid) returns jsonb language sql stable security definer set search_path='' as $f$
 select jsonb_build_object(
  'equipped',jsonb_build_object('frame',c.frame,'plate',c.plate,'thread',c.thread),
  'owned',coalesce((select jsonb_agg(t.item order by t.item) from poker_private.member_tickets t join poker_private.shop_items i on i.code=t.item and i.kind='cosmetic' where t.member_id=p_member and t.count>0),'[]'::jsonb),
  'freeForNow',poker_private.cosmetics_free_for_now())
 from (select 1) one left join poker_private.member_cosmetics c on c.member_id=p_member;
$f$;
revoke all on function poker_private.cosmetics_status_for(uuid) from public,anon,authenticated,service_role;

create or replace function public.poker_cosmetics_status() returns jsonb language plpgsql security definer set search_path='' as $f$
declare who uuid:=auth.uid();
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required';end if;
 return poker_private.cosmetics_status_for(who);
end;$f$;
revoke all on function public.poker_cosmetics_status() from public,anon,service_role;
grant execute on function public.poker_cosmetics_status() to authenticated;

-- 3つまとめて選ぶ(null＝標準)。持っていないもの(販売開始後)や種類違いは選べない。
create or replace function public.poker_cosmetics_equip(p_frame text,p_plate text,p_thread text) returns jsonb language plpgsql security definer set search_path='' as $f$
declare who uuid:=auth.uid();
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required';end if;
 if not poker_private.cosmetic_ok(who,p_frame,'frame_') or not poker_private.cosmetic_ok(who,p_plate,'plate_') or not poker_private.cosmetic_ok(who,p_thread,'thread_') then raise exception 'Invalid cosmetic';end if;
 insert into poker_private.member_cosmetics(member_id,frame,plate,thread) values(who,p_frame,p_plate,p_thread)
  on conflict (member_id) do update set frame=excluded.frame,plate=excluded.plate,thread=excluded.thread,updated_at=now();
 return poker_private.cosmetics_status_for(who);
end;$f$;
revoke all on function public.poker_cosmetics_equip(text,text,text) from public,anon,service_role;
grant execute on function public.poker_cosmetics_equip(text,text,text) to authenticated;

-- 他の会員の見た目(サミットの投稿者など)。選んだコードだけで、会員の情報は返さない。ログイン前でも見られる。
create or replace function public.poker_cosmetics_for(p_members uuid[]) returns jsonb language sql stable security definer set search_path='' as $f$
 select coalesce(jsonb_agg(jsonb_build_object('userId',c.member_id,'frame',c.frame,'plate',c.plate,'thread',c.thread)),'[]'::jsonb)
 from poker_private.member_cosmetics c where c.member_id=any(p_members[1:200]);
$f$;
revoke all on function public.poker_cosmetics_for(uuid[]) from public;
grant execute on function public.poker_cosmetics_for(uuid[]) to anon,authenticated;

-- 卓の会員情報・大会の参加者名にも、選んだ枠とプレートを載せる。
create or replace function poker_display.ring_member_profiles(p_table uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if who is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or public.is_suspended() is distinct from false then raise exception 'Not authorized'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('seat',r.seat_number,'displayName',left(coalesce(nullif(p.display_name,''),'会員'),80),'avatarUrl',p.avatar_url,
    'you',r.member_id=who,'color',n.color,'frame',c.frame,'plate',c.plate) order by r.seat_number),'[]'::jsonb)
  from poker_private.ring_fund_reservations r join public.poker_ring_tables t on t.id=r.table_id and t.published and t.deleted_at is null
  left join public.profiles p on p.user_id=r.member_id
  left join poker_private.member_notes n on n.owner_id=who and n.target_id=r.member_id
  left join poker_private.member_cosmetics c on c.member_id=r.member_id
  where r.table_id=p_table and r.status='seated');
end; $$;
revoke all on function poker_display.ring_member_profiles(uuid) from public,anon;
grant execute on function poker_display.ring_member_profiles(uuid) to authenticated;

create or replace function public.poker_ring_member_profiles(p_table uuid)
returns jsonb language sql stable set search_path='' as $$select poker_display.ring_member_profiles(p_table);$$;
revoke all on function public.poker_ring_member_profiles(uuid) from public,anon;
grant execute on function public.poker_ring_member_profiles(uuid) to authenticated;


create or replace function poker_display.tournament_entrant_names(p_room uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if who is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or public.is_suspended() is distinct from false then raise exception 'Not authorized'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('entry','e-'||x.n,'displayName',left(coalesce(nullif(p.display_name,''),'会員'),80),'you',x.member_id=who,'frame',c.frame,'plate',c.plate) order by x.n),'[]'::jsonb)
  from (select a.member_id,row_number() over(order by a.member_id::text collate "C") n from poker_private.room_admissions a where a.room_id=p_room) x
  left join public.profiles p on p.user_id=x.member_id
  left join poker_private.member_cosmetics c on c.member_id=x.member_id);
end; $$;
