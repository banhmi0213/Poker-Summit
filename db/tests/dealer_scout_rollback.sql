// Isolated staging only. CREATE SCHEMA private deliberately fails on a configured production DB.
begin;

create schema private;
grant usage on schema private to service_role;
create table public.addons(id uuid primary key default gen_random_uuid(),code text,name text,monthly_fee integer,description text,billing_type text,needs_fulfillment boolean,active boolean,sort_order integer);
create unique index addons_code_key on public.addons(code) where code is not null;
create table public.addon_orders(id uuid primary key default gen_random_uuid(),store_id uuid,addon_code text,addon_name text,billing_type text,quantity integer,unit_price integer,total_amount integer,payment_method text,status text default 'awaiting_payment',paid_at timestamptz,completed_at timestamptz);
grant all on public.addon_orders to service_role;
create table public.dealer_matching_records(id uuid primary key default gen_random_uuid(),store_id uuid,job_snapshot jsonb);
-- 1 credit buys one new work offer to one dealer. Reopening an existing chat is free.
create table if not exists public.store_scout_credits (
 store_id uuid primary key references public.stores(id) on delete cascade,
 balance integer not null default 0 check(balance >= 0),
 updated_at timestamptz not null default now()
);
alter table public.store_scout_credits enable row level security;
revoke all on public.store_scout_credits from public,anon,authenticated;
grant select on public.store_scout_credits to authenticated;
grant all on public.store_scout_credits to service_role;
create policy scout_credit_owner_read on public.store_scout_credits for select to authenticated
 using(exists(select 1 from public.stores s where s.id=store_id and s.owner_user_id=(select auth.uid())) or public.is_admin());

-- Kept private: no client may mint credits or replay a paid order.
create table if not exists private.scout_credit_grants (
 order_id uuid primary key references public.addon_orders(id) on delete cascade,
 store_id uuid not null references public.stores(id) on delete cascade,
 quantity integer not null check(quantity>0),
 created_at timestamptz not null default now()
);
revoke all on private.scout_credit_grants from public,anon,authenticated;
grant all on private.scout_credit_grants to service_role;

create or replace function public.fulfill_dealer_scout_order(p_order_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare o public.addon_orders; granted uuid;
begin
 select * into o from public.addon_orders where id=p_order_id for update;
 if not found or o.addon_code<>'dealer_scout' or o.billing_type<>'one_time'
    or o.paid_at is null or o.status not in('paid','in_progress','completed','awaiting_payment') then
  raise exception '入金確認済みのスカウト注文が必要です。';
 end if;
 if o.quantity<1 or o.quantity>50 then raise exception 'スカウト人数が正しくありません。'; end if;
 insert into private.scout_credit_grants(order_id,store_id,quantity) values(o.id,o.store_id,o.quantity)
 on conflict(order_id) do nothing returning order_id into granted;
 if granted is not null then
  insert into public.store_scout_credits(store_id,balance) values(o.store_id,o.quantity)
  on conflict(store_id) do update set balance=public.store_scout_credits.balance+excluded.balance,updated_at=now();
 end if;
 update public.addon_orders set status='completed',completed_at=coalesce(completed_at,now()) where id=o.id;
end $$;
revoke all on function public.fulfill_dealer_scout_order(uuid) from public,anon,authenticated;
grant execute on function public.fulfill_dealer_scout_order(uuid) to service_role;

create or replace function private.consume_dealer_scout_credit()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.job_snapshot->>'source' <> 'store_offer' or new.job_snapshot->>'source' is null then return new; end if;
 if auth.uid() is null or not exists(select 1 from public.stores s where s.id=new.store_id and s.owner_user_id=auth.uid()) then
  raise exception '自店舗からのみスカウトできます。';
 end if;
 update public.store_scout_credits set balance=balance-1,updated_at=now()
 where store_id=new.store_id and balance>0;
 if not found then raise exception 'スカウト枠がありません。「プラン・お支払い」からディーラースカウトをご購入ください。'; end if;
 return new;
end $$;
revoke all on function private.consume_dealer_scout_credit() from public,anon,authenticated;
create trigger consume_dealer_scout_credit after insert on public.dealer_matching_records
 for each row execute function private.consume_dealer_scout_credit();

insert into public.addons(code,name,monthly_fee,description,billing_type,needs_fulfillment,active,sort_order)
values('dealer_scout','ディーラースカウト',2200,'希望条件に合うディーラーに、店舗から直接スカウトを送れます。スカウト1人につき2,200円（税込）。採用・勤務の成立を保証するものではありません。','one_time',false,false,45)
on conflict(code) where code is not null do nothing;

-- Execute after schema installation, inside a transaction; no emails, real charges or records are sent.

create temporary table scout_test_offers(id uuid primary key,store_id uuid,job_snapshot jsonb);
create trigger test_consume_scout after insert on scout_test_offers for each row execute function private.consume_dealer_scout_credit();
do $$
declare sid uuid; uid uuid; oid uuid; unpaid uuid; offerid uuid:=gen_random_uuid(); blocked boolean;
begin
 insert into public.stores(name) values('SCOUT QA ROLLBACK') returning id into sid;
 insert into auth.users(id) values(gen_random_uuid()) returning id into uid;
 if sid is null or uid is null then raise exception 'Test requires one unowned store and one existing account'; end if;
 update public.stores set owner_user_id=uid where id=sid;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 insert into public.addon_orders(store_id,addon_code,addon_name,billing_type,quantity,unit_price,total_amount,payment_method,status,paid_at)
 values(sid,'dealer_scout','QA scout','one_time',2,2200,4400,'card','paid',now()) returning id into oid;
 perform public.fulfill_dealer_scout_order(oid);
 perform public.fulfill_dealer_scout_order(oid);
 if (select balance from public.store_scout_credits where store_id=sid)<>2 then raise exception 'Paid order grant was duplicated'; end if;
 insert into public.addon_orders(store_id,addon_code,addon_name,billing_type,quantity,unit_price,total_amount,payment_method)
 values(sid,'dealer_scout','QA unpaid','one_time',1,2200,2200,'bank_transfer') returning id into unpaid;
 blocked:=false;begin perform public.fulfill_dealer_scout_order(unpaid);exception when raise_exception then blocked:=true;end;
 if not blocked then raise exception 'Unpaid order granted credit';end if;
 insert into scout_test_offers values(offerid,sid,'{"source":"store_offer"}');
 insert into scout_test_offers values(offerid,sid,'{"source":"store_offer"}') on conflict do nothing;
 if (select balance from public.store_scout_credits where store_id=sid)<>1 then raise exception 'Duplicate offer consumed credit';end if;
 insert into scout_test_offers values(gen_random_uuid(),sid,'{"source":"dealer_application"}');
 if (select balance from public.store_scout_credits where store_id=sid)<>1 then raise exception 'Inbound application consumed credit';end if;
 perform set_config('request.jwt.claim.sub','',true);
 blocked:=false;begin insert into scout_test_offers values(gen_random_uuid(),sid,'{"source":"store_offer"}');exception when raise_exception then blocked:=true;end;
 if not blocked then raise exception 'Unauthenticated sender accepted';end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 insert into scout_test_offers values(gen_random_uuid(),sid,'{"source":"store_offer"}');
 blocked:=false;begin insert into scout_test_offers values(gen_random_uuid(),sid,'{"source":"store_offer"}');exception when raise_exception then blocked:=true;end;
 if not blocked or (select balance from public.store_scout_credits where store_id=sid)<>0 then raise exception 'Zero balance accepted or underflow';end if;
 if has_function_privilege('authenticated','public.fulfill_dealer_scout_order(uuid)','execute') or has_function_privilege('anon','public.fulfill_dealer_scout_order(uuid)','execute') then raise exception 'Client can mint credits';end if;
 if has_table_privilege('authenticated','public.store_scout_credits','update') then raise exception 'Client can change balance';end if;
end $$;
select 'PASS: paid-order replay, unpaid rejection, offer consumption, duplicate protection, inbound application, sender ownership, zero balance, client permissions' as verification;

rollback;

