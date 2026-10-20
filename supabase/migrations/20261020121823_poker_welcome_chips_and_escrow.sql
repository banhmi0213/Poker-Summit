begin;
create schema if not exists poker_private;
revoke all on schema poker_private from public,anon;
grant usage on schema poker_private to authenticated,service_role;
create table if not exists poker_private.ring_accounts(
 member_id uuid primary key,
 available bigint not null default 0 check(available between 0 and 4503599627370495),
 in_play bigint not null default 0 check(in_play between 0 and 4503599627370495),
 updated_at timestamptz not null default now()
);
-- UUIDs in the financial record are historical identifiers. Retain accounting
-- records on auth-user deletion rather than blocking account withdrawal.
do $$declare c record;begin
 for c in select conname from pg_constraint where conrelid='poker_private.ring_accounts'::regclass and contype='f' and confrelid='auth.users'::regclass loop
  execute format('alter table poker_private.ring_accounts drop constraint %I',c.conname);
 end loop;
end;$$;
create table poker_private.ring_identity_secret(id boolean primary key default true check(id),secret bytea not null check(octet_length(secret)=32));
insert into poker_private.ring_identity_secret values(true,extensions.gen_random_bytes(32));
create table poker_private.ring_welcome_claims(
 identity_key bytea primary key check(octet_length(identity_key)=32),member_id uuid not null unique,amount bigint not null default 3000 check(amount=3000),created_at timestamptz not null default now()
);
create table poker_private.ring_fund_reservations(
 id uuid primary key,member_id uuid not null references poker_private.ring_accounts(member_id),table_id uuid not null references public.poker_ring_tables(id),
 amount bigint not null check(amount between 1 and 1000000000),status text not null default 'held' check(status in('held','returned')),
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '2 minutes',returned_at timestamptz,
 check((status='returned')=(returned_at is not null))
);
create unique index ring_one_hold_per_member on poker_private.ring_fund_reservations(member_id) where status='held';
create index ring_table_holds on poker_private.ring_fund_reservations(table_id) where status='held';
create table poker_private.ring_chip_ledger(
 id uuid primary key default gen_random_uuid(),member_id uuid not null references poker_private.ring_accounts(member_id),
 request_id uuid not null,kind text not null check(kind in('welcome','reserve','refund')),
 reservation_id uuid references poker_private.ring_fund_reservations(id),available_delta bigint not null,in_play_delta bigint not null,
 created_at timestamptz not null default now(),unique(member_id,request_id),
 check((kind='welcome' and available_delta=3000 and in_play_delta=0 and reservation_id is null) or
 (kind='reserve' and available_delta<0 and in_play_delta=-available_delta and reservation_id is not null) or
 (kind='refund' and available_delta>0 and in_play_delta=-available_delta and reservation_id is not null))
);
create unique index ring_one_welcome_per_member on poker_private.ring_chip_ledger(member_id) where kind='welcome';
create unique index ring_one_reservation_event on poker_private.ring_chip_ledger(reservation_id,kind) where reservation_id is not null;
create index ring_chip_history on poker_private.ring_chip_ledger(member_id,created_at desc,id);
alter table poker_private.ring_accounts enable row level security;
alter table poker_private.ring_identity_secret enable row level security;
alter table poker_private.ring_welcome_claims enable row level security;
alter table poker_private.ring_fund_reservations enable row level security;
alter table poker_private.ring_chip_ledger enable row level security;
revoke all on poker_private.ring_accounts,poker_private.ring_identity_secret,poker_private.ring_welcome_claims,poker_private.ring_fund_reservations,poker_private.ring_chip_ledger from public,anon,authenticated,service_role;
grant select on poker_private.ring_accounts,poker_private.ring_fund_reservations,poker_private.ring_chip_ledger to service_role;

create function poker_private.ensure_ring_welcome(p_member uuid) returns void language plpgsql security definer set search_path='' as $$
declare email_address text; identity bytea; accepted uuid;
begin
 select lower(btrim(u.email)) into email_address from auth.users u where u.id=p_member and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and u.deleted_at is null and (u.banned_until is null or u.banned_until<now()) and u.email is not null and u.email not ilike '%@login.poker-summit.jp' and not exists(select 1 from public.admin_users a where a.user_id=u.id) and not exists(select 1 from public.member_status s where s.user_id=u.id and s.suspended) for key share;
 if email_address is null then return;end if;
 insert into poker_private.ring_accounts(member_id) values(p_member) on conflict do nothing;
 perform 1 from poker_private.ring_accounts where member_id=p_member for update;
 if exists(select 1 from poker_private.ring_welcome_claims where member_id=p_member) then return;end if;
 select extensions.hmac(convert_to(email_address,'UTF8'),secret,'sha256') into identity from poker_private.ring_identity_secret where id;
 insert into poker_private.ring_welcome_claims(identity_key,member_id) values(identity,p_member) on conflict do nothing returning member_id into accepted;
 if accepted is null then return;end if;
 update poker_private.ring_accounts set available=available+3000,updated_at=now() where member_id=p_member;
 insert into poker_private.ring_chip_ledger(member_id,request_id,kind,available_delta,in_play_delta) values(p_member,gen_random_uuid(),'welcome',3000,0);
end;$$;
revoke all on function poker_private.ensure_ring_welcome(uuid) from public,anon,authenticated,service_role;
create function poker_private.on_ring_member_confirmed() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.email_confirmed_at is not null then perform poker_private.ensure_ring_welcome(new.id);end if;return new;
end;$$;
revoke all on function poker_private.on_ring_member_confirmed() from public,anon,authenticated,service_role;
create trigger ring_member_confirmed after insert or update of email_confirmed_at on auth.users for each row execute function poker_private.on_ring_member_confirmed();

create or replace function poker_private.ring_balance() returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); result jsonb;
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required';end if;
 perform poker_private.ensure_ring_welcome(who);
 select jsonb_build_object('available',a.available,'inPlay',a.in_play,'total',a.available+a.in_play,
 'rank',1+(select count(*) from poker_private.ring_accounts other join auth.users u on u.id=other.member_id where other.available+other.in_play>a.available+a.in_play and not coalesce(u.is_anonymous,false) and u.email_confirmed_at is not null and u.deleted_at is null and not exists(select 1 from public.admin_users ad where ad.user_id=u.id)),
 'welcomeGranted',exists(select 1 from poker_private.ring_welcome_claims where member_id=who),'asOf',now(),
 'history',coalesce((select jsonb_agg(to_jsonb(h)) from(select kind,available_delta as "availableDelta",in_play_delta as "inPlayDelta",created_at as "createdAt" from poker_private.ring_chip_ledger where member_id=who order by created_at desc,id desc limit 20) h),'[]'::jsonb)) into result from poker_private.ring_accounts a where member_id=who;
 return coalesce(result,jsonb_build_object('available',0,'inPlay',0,'total',0,'rank',null,'welcomeGranted',false,'asOf',now(),'history','[]'::jsonb));
end;$$;
revoke all on function poker_private.ring_balance() from public,anon,service_role;
grant execute on function poker_private.ring_balance() to authenticated;
create or replace function public.poker_ring_balance() returns jsonb language sql security invoker set search_path='' as $$select poker_private.ring_balance();$$;
revoke all on function public.poker_ring_balance() from public,anon,service_role;
grant execute on function public.poker_ring_balance() to authenticated;

-- Funding reservations are server-only groundwork, not playable seats.
create function poker_private.ring_reserve_funds(p_member uuid,p_table uuid,p_amount bigint,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.poker_ring_tables%rowtype;r poker_private.ring_fund_reservations%rowtype;a poker_private.ring_accounts%rowtype;
begin
 if p_request is null or p_amount is null or p_amount<1 then raise exception 'Invalid reservation';end if;
 perform poker_private.ensure_ring_welcome(p_member);
 select * into a from poker_private.ring_accounts where member_id=p_member for update;
 if not found then raise exception 'Account unavailable';end if;
 select * into r from poker_private.ring_fund_reservations where id=p_request;
 if found then
  if r.member_id<>p_member or r.table_id<>p_table or r.amount<>p_amount then raise exception 'Request conflict';end if;
  return to_jsonb(r);
 end if;
 select * into t from public.poker_ring_tables where id=p_table for update;
 if not found or not t.published or t.deleted_at is not null then raise exception 'Table unavailable';end if;
 if p_amount<t.min_buy_in or p_amount>t.max_buy_in then raise exception 'Buy-in outside range';end if;
 if a.available<p_amount then raise exception 'Insufficient chips';end if;
 if (select count(*) from poker_private.ring_fund_reservations where table_id=p_table and status='held')>=t.capacity then raise exception 'Table full';end if;
 if exists(select 1 from poker_private.ring_fund_reservations where member_id=p_member and status='held') then raise exception 'Member already reserved';end if;
 insert into poker_private.ring_fund_reservations(id,member_id,table_id,amount) values(p_request,p_member,p_table,p_amount) returning * into r;
 update poker_private.ring_accounts set available=available-p_amount,in_play=in_play+p_amount,updated_at=now() where member_id=p_member;
 insert into poker_private.ring_chip_ledger(member_id,request_id,kind,reservation_id,available_delta,in_play_delta) values(p_member,p_request,'reserve',p_request,-p_amount,p_amount);
 return to_jsonb(r);
end;$$;
create function poker_private.ring_return_reserved_funds(p_reservation uuid,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r poker_private.ring_fund_reservations%rowtype;old_event poker_private.ring_chip_ledger%rowtype;
begin
 if p_request is null then raise exception 'Invalid request';end if;
 select * into r from poker_private.ring_fund_reservations where id=p_reservation;
 if not found then raise exception 'Reservation unavailable';end if;
 perform 1 from poker_private.ring_accounts where member_id=r.member_id for update;
 select * into r from poker_private.ring_fund_reservations where id=p_reservation for update;
 select * into old_event from poker_private.ring_chip_ledger where member_id=r.member_id and request_id=p_request;
 if found and (old_event.kind<>'refund' or old_event.reservation_id<>r.id) then raise exception 'Request conflict';end if;
 if r.status='returned' then return to_jsonb(r);end if;
 if exists(select 1 from poker_private.ring_accounts where member_id=r.member_id and in_play<r.amount) then raise exception 'Accounting mismatch';end if;
 update poker_private.ring_accounts set available=available+r.amount,in_play=in_play-r.amount,updated_at=now() where member_id=r.member_id;
 update poker_private.ring_fund_reservations set status='returned',returned_at=now() where id=r.id returning * into r;
 insert into poker_private.ring_chip_ledger(member_id,request_id,kind,reservation_id,available_delta,in_play_delta) values(r.member_id,p_request,'refund',r.id,r.amount,-r.amount);
 return to_jsonb(r);
end;$$;
revoke all on function poker_private.ring_reserve_funds(uuid,uuid,bigint,uuid),poker_private.ring_return_reserved_funds(uuid,uuid) from public,anon,authenticated;
grant execute on function poker_private.ring_reserve_funds(uuid,uuid,bigint,uuid),poker_private.ring_return_reserved_funds(uuid,uuid) to service_role;
create function public.poker_ring_reserve_funds(p_member uuid,p_table uuid,p_amount bigint,p_request uuid) returns jsonb language sql security invoker set search_path='' as $$select poker_private.ring_reserve_funds(p_member,p_table,p_amount,p_request);$$;
create function public.poker_ring_return_reserved_funds(p_reservation uuid,p_request uuid) returns jsonb language sql security invoker set search_path='' as $$select poker_private.ring_return_reserved_funds(p_reservation,p_request);$$;
revoke all on function public.poker_ring_reserve_funds(uuid,uuid,bigint,uuid),public.poker_ring_return_reserved_funds(uuid,uuid) from public,anon,authenticated;
grant execute on function public.poker_ring_reserve_funds(uuid,uuid,bigint,uuid),public.poker_ring_return_reserved_funds(uuid,uuid) to service_role;
create function poker_private.ring_preserve_ledger() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Accounting history is immutable';end;$$;
revoke all on function poker_private.ring_preserve_ledger() from public,anon,authenticated,service_role;
create trigger ring_ledger_immutable before update or delete on poker_private.ring_chip_ledger for each row execute function poker_private.ring_preserve_ledger();
create trigger ring_welcome_immutable before update or delete on poker_private.ring_welcome_claims for each row execute function poker_private.ring_preserve_ledger();
create function poker_private.ring_guard_table_settings() returns trigger language plpgsql security definer set search_path='' as $$begin
 if (new.deleted_at is distinct from old.deleted_at or new.published is distinct from old.published or new.sb<>old.sb or new.bb<>old.bb or new.capacity<>old.capacity or new.min_buy_in<>old.min_buy_in or new.max_buy_in<>old.max_buy_in) and exists(select 1 from poker_private.ring_fund_reservations where table_id=old.id and status='held') then raise exception 'Table has reserved funds';end if;return new;
end;$$;
revoke all on function poker_private.ring_guard_table_settings() from public,anon,authenticated,service_role;
create trigger ring_guard_table_settings before update on public.poker_ring_tables for each row execute function poker_private.ring_guard_table_settings();
commit;
