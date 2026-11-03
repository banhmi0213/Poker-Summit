begin;
create or replace function poker_private.ring_reserve_funds(p_member uuid,p_table uuid,p_amount bigint,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.poker_ring_tables%rowtype;r poker_private.ring_fund_reservations%rowtype;a poker_private.ring_accounts%rowtype;
begin
 if p_request is null or p_amount is null or p_amount<1 then raise exception 'Invalid reservation';end if;
 if not exists(select 1 from auth.users u where u.id=p_member and u.email_confirmed_at is not null and u.deleted_at is null and not coalesce(u.is_anonymous,false) and u.email is not null and u.email not ilike '%@login.poker-summit.jp' and (u.banned_until is null or u.banned_until<now()) and not exists(select 1 from public.member_status ms where ms.user_id=u.id and ms.suspended)) then raise exception 'Account unavailable';end if;
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

commit;
