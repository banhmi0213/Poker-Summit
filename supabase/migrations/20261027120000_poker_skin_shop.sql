-- Skins in the chip exchange (owner 2026/10/27: 卓4・カード表3・裏4、一部無料・一部ショップ; prices from Daniel's hand-off).
-- A skin is exchanged once and kept for good: it is a member_tickets row with count 1 that is never spent.
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='poker_private' and table_name='shop_items' and column_name='kind') then
  alter table poker_private.shop_items add column kind text not null default 'ticket';
 end if;
 if not exists(select 1 from pg_constraint where conname='shop_items_kind_check') then
  alter table poker_private.shop_items add constraint shop_items_kind_check check(kind in('ticket','skin'));
 end if;
end $$;

insert into poker_private.shop_items(code,label,description,price,kind,sort) values
 ('table_forest','卓の着せ替え：フォレスト','卓を深い緑の羅紗に。一度交換すればずっと使えます。',3000,'skin',20),
 ('table_bordeaux','卓の着せ替え：ボルドー','卓をボルドーの羅紗に。一度交換すればずっと使えます。',3000,'skin',21),
 ('table_navy','卓の着せ替え：ネイビー','卓をネイビーの羅紗に。一度交換すればずっと使えます。',3000,'skin',22),
 ('card_front_fourcolor','カードの表：4カラー','♣は緑、♦は青の見分けやすいカード。ずっと使えます。',1500,'skin',30),
 ('card_front_royal','カードの表：ロイヤル絵札','J・Q・Kが人物画の絵札になります。ずっと使えます。',2500,'skin',31),
 ('card_back_onyx','カードの裏：オニキスゴールド','黒と金の裏面。一度交換すればずっと使えます。',1500,'skin',40),
 ('card_back_ivory','カードの裏：アイボリーゴールド','アイボリーと金の裏面。一度交換すればずっと使えます。',1500,'skin',41),
 ('card_back_bordeaux','カードの裏：ボルドーゴールド','ボルドーと金の裏面。一度交換すればずっと使えます。',1500,'skin',42)
on conflict (code) do nothing;

create or replace function poker_private.shop_view() returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required';end if;
 perform poker_private.ensure_ring_welcome(who);
 return jsonb_build_object(
  'available',coalesce((select available from poker_private.ring_accounts where member_id=who),0),
  'items',coalesce((select jsonb_agg(jsonb_build_object('code',i.code,'label',i.label,'description',i.description,'price',i.price,'kind',i.kind) order by i.sort,i.code) from poker_private.shop_items i where i.active and i.price is not null),'[]'::jsonb),
  'tickets',coalesce((select jsonb_object_agg(t.item,t.count) from poker_private.member_tickets t where t.member_id=who and t.count>0),'{}'::jsonb),
  'history',coalesce((select jsonb_agg(to_jsonb(h)) from(select l.item,i.label,l.quantity,l.total,l.created_at as "createdAt" from poker_private.shop_ledger l join poker_private.shop_items i on i.code=l.item where l.member_id=who order by l.created_at desc,l.id desc limit 10) h),'[]'::jsonb));
end;$$;
revoke all on function poker_private.shop_view() from public,anon,service_role;
grant execute on function poker_private.shop_view() to authenticated;

create or replace function poker_private.shop_exchange(p_item text,p_quantity integer,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();i poker_private.shop_items%rowtype;a poker_private.ring_accounts%rowtype;prior poker_private.shop_ledger%rowtype;cost bigint;
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required';end if;
 if p_request is null or p_quantity is null or p_quantity<1 or p_quantity>10 then raise exception 'Invalid exchange';end if;
 perform poker_private.ensure_ring_welcome(who);
 select * into a from poker_private.ring_accounts where member_id=who for update;
 if not found then raise exception 'Account unavailable';end if;
 select * into prior from poker_private.shop_ledger where member_id=who and request_id=p_request;
 if found then
  if prior.item<>p_item or prior.quantity<>p_quantity then raise exception 'Request conflict';end if;
  return poker_private.shop_view();
 end if;
 select * into i from poker_private.shop_items where code=p_item;
 if not found or not i.active or i.price is null then raise exception 'Item unavailable';end if;
 -- Skins: one at a time and only once.
 if i.kind='skin' then
  if p_quantity<>1 then raise exception 'Invalid exchange';end if;
  if exists(select 1 from poker_private.member_tickets t where t.member_id=who and t.item=p_item and t.count>0) then raise exception 'Already owned';end if;
 end if;
 cost:=i.price*p_quantity;
 if a.available<cost then raise exception 'Insufficient chips';end if;
 update poker_private.ring_accounts set available=available-cost,updated_at=now() where member_id=who;
 insert into poker_private.shop_ledger(member_id,request_id,item,quantity,price_each,total) values(who,p_request,p_item,p_quantity,i.price,cost);
 insert into poker_private.member_tickets(member_id,item,count) values(who,p_item,p_quantity)
  on conflict (member_id,item) do update set count=poker_private.member_tickets.count+excluded.count,updated_at=now();
 return poker_private.shop_view();
end;$$;
revoke all on function poker_private.shop_exchange(text,integer,uuid) from public,anon,service_role;
grant execute on function poker_private.shop_exchange(text,integer,uuid) to authenticated;

-- Skins are never spent by game actions.
create or replace function poker_private.ticket_use(p_member uuid,p_item text,p_ref text) returns boolean language plpgsql security definer set search_path='' as $$
declare left_count integer;
begin
 if p_member is null or p_item is null or p_ref is null or length(p_ref) not between 1 and 200 then raise exception 'Invalid ticket use';end if;
 if exists(select 1 from poker_private.shop_items s where s.code=p_item and s.kind='skin') then return false;end if;
 if exists(select 1 from poker_private.ticket_uses where member_id=p_member and item=p_item and ref=p_ref) then return true;end if;
 update poker_private.member_tickets set count=count-1,updated_at=now() where member_id=p_member and item=p_item and count>0 returning count into left_count;
 if not found then return false;end if;
 insert into poker_private.ticket_uses(member_id,item,ref) values(p_member,p_item,p_ref);
 return true;
end;$$;
revoke all on function poker_private.ticket_use(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function poker_private.ticket_use(uuid,text,text) to service_role;
