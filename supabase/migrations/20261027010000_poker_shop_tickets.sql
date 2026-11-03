-- Summit chip exchange: members trade available ring chips for tickets (time bank, rabbit).
-- Prices are set by admins later; an item without a price is not offered. Tickets are used in ring games only.
create table if not exists poker_private.shop_items(
 code text primary key check(code ~ '^[a-z_]{1,32}$'),
 label text not null check(length(label) between 1 and 40),
 description text not null default '' check(length(description)<=200),
 price bigint check(price is null or (price>=1 and price<=1000000)),
 active boolean not null default true,
 sort integer not null default 0,
 updated_at timestamptz not null default now()
);
alter table poker_private.shop_items enable row level security;
insert into poker_private.shop_items(code,label,description,sort) values
 ('time_bank','タイムバンク +30秒','リングで持ち時間を30秒延ばせます。',1),
 ('rabbit','ラビット','リングで途中で終わったハンドの、残りのボードを見られます。',2)
on conflict (code) do nothing;

create table if not exists poker_private.member_tickets(
 member_id uuid not null references auth.users(id) on delete cascade,
 item text not null references poker_private.shop_items(code),
 count integer not null default 0 check(count>=0 and count<=100000),
 updated_at timestamptz not null default now(),
 primary key(member_id,item)
);
alter table poker_private.member_tickets enable row level security;

create table if not exists poker_private.shop_ledger(
 id bigint generated always as identity primary key,
 member_id uuid not null references poker_private.ring_accounts(member_id),
 request_id uuid not null,
 item text not null references poker_private.shop_items(code),
 quantity integer not null check(quantity between 1 and 10),
 price_each bigint not null check(price_each>=1),
 total bigint not null check(total=price_each*quantity),
 created_at timestamptz not null default now(),
 unique(member_id,request_id)
);
alter table poker_private.shop_ledger enable row level security;

create table if not exists poker_private.ticket_uses(
 id bigint generated always as identity primary key,
 member_id uuid not null references auth.users(id) on delete cascade,
 item text not null references poker_private.shop_items(code),
 ref text not null check(length(ref) between 1 and 200),
 created_at timestamptz not null default now(),
 unique(member_id,item,ref)
);
alter table poker_private.ticket_uses enable row level security;

-- What the signed-in member sees in the exchange: priced items, their ticket counts and spendable chips.
create or replace function poker_private.shop_view() returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required';end if;
 perform poker_private.ensure_ring_welcome(who);
 return jsonb_build_object(
  'available',coalesce((select available from poker_private.ring_accounts where member_id=who),0),
  'items',coalesce((select jsonb_agg(jsonb_build_object('code',i.code,'label',i.label,'description',i.description,'price',i.price) order by i.sort,i.code) from poker_private.shop_items i where i.active and i.price is not null),'[]'::jsonb),
  'tickets',coalesce((select jsonb_object_agg(t.item,t.count) from poker_private.member_tickets t where t.member_id=who and t.count>0),'{}'::jsonb),
  'history',coalesce((select jsonb_agg(to_jsonb(h)) from(select l.item,i.label,l.quantity,l.total,l.created_at as "createdAt" from poker_private.shop_ledger l join poker_private.shop_items i on i.code=l.item where l.member_id=who order by l.created_at desc,l.id desc limit 10) h),'[]'::jsonb));
end;$$;
revoke all on function poker_private.shop_view() from public,anon,service_role;
grant execute on function poker_private.shop_view() to authenticated;
create or replace function public.poker_shop() returns jsonb language sql security invoker set search_path='' as $$select poker_private.shop_view();$$;
revoke all on function public.poker_shop() from public,anon,service_role;
grant execute on function public.poker_shop() to authenticated;

-- Exchange chips for tickets. A repeated request id returns the first result without charging again.
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
create or replace function public.poker_shop_exchange(p_item text,p_quantity integer,p_request uuid) returns jsonb language sql security invoker set search_path='' as $$select poker_private.shop_exchange(p_item,p_quantity,p_request);$$;
revoke all on function public.poker_shop_exchange(text,integer,uuid) from public,anon,service_role;
grant execute on function public.poker_shop_exchange(text,integer,uuid) to authenticated;

-- Server-only: spend one ticket for a game action. The same ref never spends twice.
create or replace function poker_private.ticket_use(p_member uuid,p_item text,p_ref text) returns boolean language plpgsql security definer set search_path='' as $$
declare left_count integer;
begin
 if p_member is null or p_item is null or p_ref is null or length(p_ref) not between 1 and 200 then raise exception 'Invalid ticket use';end if;
 if exists(select 1 from poker_private.ticket_uses where member_id=p_member and item=p_item and ref=p_ref) then return true;end if;
 update poker_private.member_tickets set count=count-1,updated_at=now() where member_id=p_member and item=p_item and count>0 returning count into left_count;
 if not found then return false;end if;
 insert into poker_private.ticket_uses(member_id,item,ref) values(p_member,p_item,p_ref);
 return true;
end;$$;
revoke all on function poker_private.ticket_use(uuid,text,text) from public,anon,authenticated,service_role;
create or replace function public.poker_ticket_use(p_member uuid,p_item text,p_ref text) returns boolean language sql security invoker set search_path='' as $$select poker_private.ticket_use(p_member,p_item,p_ref);$$;
revoke all on function public.poker_ticket_use(uuid,text,text) from public,anon,authenticated;
grant execute on function poker_private.ticket_use(uuid,text,text) to service_role;
grant execute on function public.poker_ticket_use(uuid,text,text) to service_role;

-- Admin: list every item (priced or not) and set price / on-off.
create or replace function poker_private.shop_admin_items() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.is_admin(),false) or coalesce(public.is_suspended(),true) then raise exception 'Admin required';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('code',code,'label',label,'description',description,'price',price,'active',active) order by sort,code) from poker_private.shop_items),'[]'::jsonb);
end;$$;
revoke all on function poker_private.shop_admin_items() from public,anon,service_role;
grant execute on function poker_private.shop_admin_items() to authenticated;
create or replace function public.poker_admin_shop_items() returns jsonb language sql security invoker set search_path='' as $$select poker_private.shop_admin_items();$$;
revoke all on function public.poker_admin_shop_items() from public,anon,service_role;
grant execute on function public.poker_admin_shop_items() to authenticated;

create or replace function poker_private.shop_admin_save(p_item text,p_price bigint,p_active boolean) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.is_admin(),false) or coalesce(public.is_suspended(),true) then raise exception 'Admin required';end if;
 if p_active is null or (p_price is not null and (p_price<1 or p_price>1000000)) then raise exception 'Invalid price';end if;
 update poker_private.shop_items set price=p_price,active=p_active,updated_at=now() where code=p_item;
 if not found then raise exception 'Item unavailable';end if;
 return poker_private.shop_admin_items();
end;$$;
revoke all on function poker_private.shop_admin_save(text,bigint,boolean) from public,anon,service_role;
grant execute on function poker_private.shop_admin_save(text,bigint,boolean) to authenticated;
create or replace function public.poker_admin_shop_save(p_item text,p_price bigint,p_active boolean) returns jsonb language sql security invoker set search_path='' as $$select poker_private.shop_admin_save(p_item,p_price,p_active);$$;
revoke all on function public.poker_admin_shop_save(text,bigint,boolean) from public,anon,service_role;
grant execute on function public.poker_admin_shop_save(text,bigint,boolean) to authenticated;
