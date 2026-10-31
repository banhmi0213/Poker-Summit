-- 初回の会員登録ボーナスを1,000チップに(オーナー 2026/10/31：最初に配るチップは1000チップ)。
-- 0になったときの無料補充(1日3回まで)も1,000チップまでに揃える。すでに3,000を受け取った会員の記録はそのまま有効。
alter table poker_private.ring_welcome_claims alter column amount set default 1000;
alter table poker_private.ring_welcome_claims drop constraint if exists ring_welcome_claims_amount_check;
alter table poker_private.ring_welcome_claims add constraint ring_welcome_claims_amount_check check(amount in (1000,3000));
alter table poker_private.ring_chip_ledger drop constraint if exists ring_chip_ledger_check;
alter table poker_private.ring_chip_ledger add constraint ring_chip_ledger_check check(
 (kind='welcome' and available_delta in (1000,3000) and in_play_delta=0 and reservation_id is null and hand_id is null) or
 (kind='reserve' and available_delta<0 and in_play_delta=-available_delta and reservation_id is not null and hand_id is null) or
 (kind='refund' and available_delta>0 and in_play_delta=-available_delta and reservation_id is not null and hand_id is null) or
 (kind='cashout' and available_delta>=0 and in_play_delta=-available_delta and reservation_id is not null and hand_id is null) or
 (kind='settlement' and available_delta=0 and reservation_id is not null and hand_id is not null) or
 (kind='refill' and available_delta>0 and available_delta<=3000 and in_play_delta=0 and reservation_id is null and hand_id is null));


create or replace function poker_private.ensure_ring_welcome(p_member uuid) returns void language plpgsql security definer set search_path='' as $$
declare email_address text; identity bytea; accepted uuid;
begin
 select lower(btrim(u.email)) into email_address from auth.users u where u.id=p_member and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and u.deleted_at is null and (u.banned_until is null or u.banned_until<now()) and u.email is not null and u.email not ilike '%@login.poker-summit.jp' and not exists(select 1 from public.member_status s where s.user_id=u.id and s.suspended) for key share;
 if email_address is null then return;end if;
 insert into poker_private.ring_accounts(member_id) values(p_member) on conflict do nothing;
 perform 1 from poker_private.ring_accounts where member_id=p_member for update;
 if exists(select 1 from poker_private.ring_welcome_claims where member_id=p_member) then return;end if;
 select extensions.hmac(convert_to(email_address,'UTF8'),secret,'sha256') into identity from poker_private.ring_identity_secret where id;
 insert into poker_private.ring_welcome_claims(identity_key,member_id,amount) values(identity,p_member,1000) on conflict do nothing returning member_id into accepted;
 if accepted is null then return;end if;
 update poker_private.ring_accounts set available=available+1000,updated_at=now() where member_id=p_member;
 insert into poker_private.ring_chip_ledger(member_id,request_id,kind,available_delta,in_play_delta) values(p_member,gen_random_uuid(),'welcome',1000,0);
end;$$;

create or replace function public.poker_ring_refill(p_request uuid,p_table uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();a poker_private.ring_accounts%rowtype;smallest bigint;
begin
 if who is null or p_request is null or coalesce(public.is_suspended(),true) or not poker_private.ring_member_eligible(who) then raise exception 'Login required';end if;
 perform poker_private.ensure_ring_welcome(who);
 select * into a from poker_private.ring_accounts where member_id=who for update;
 if not found then raise exception 'Account unavailable';end if;
 -- A retried request returns the same balance without topping up twice.
 if exists(select 1 from poker_private.ring_chip_ledger where member_id=who and request_id=p_request) then return poker_private.ring_balance();end if;
 select coalesce(min(min_buy_in),1) into smallest from public.poker_ring_tables where published and deleted_at is null and (p_table is null or id=p_table);
 if p_table is not null and not exists(select 1 from public.poker_ring_tables where id=p_table and published and deleted_at is null) then raise exception 'Table unavailable';end if;
 if a.in_play>0 or a.available>=least(smallest,1000) then raise exception 'Refill not needed';end if;
 update poker_private.ring_accounts set available=1000,updated_at=now() where member_id=who;
 insert into poker_private.ring_chip_ledger(member_id,request_id,kind,available_delta,in_play_delta) values(who,p_request,'refill',1000-a.available,0);
 return poker_private.ring_balance();
end;$$;
revoke all on function public.poker_ring_refill(uuid,uuid) from public,anon,service_role;
grant execute on function public.poker_ring_refill(uuid,uuid) to authenticated;
