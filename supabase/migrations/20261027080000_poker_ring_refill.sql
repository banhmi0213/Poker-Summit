-- Free refill (owner 2026/10/27: "チップはなくなったら補充"). Ring chips are free and can never be bought or cashed out.
-- A member with nothing at a table and fewer chips than the table's minimum buy-in (p_table; without it the smallest
-- open table's) tops back up to 3,000. Used by 「補充して座り直す」 at the table right after busting.
-- The ledger's kind checks are widened with a new 'refill' kind (old rows keep matching).
alter table poker_private.ring_chip_ledger drop constraint if exists ring_chip_ledger_kind_check;
alter table poker_private.ring_chip_ledger add constraint ring_chip_ledger_kind_check check(kind in('welcome','reserve','refund','settlement','cashout','refill'));
alter table poker_private.ring_chip_ledger drop constraint if exists ring_chip_ledger_check;
alter table poker_private.ring_chip_ledger add constraint ring_chip_ledger_check check(
 (kind='welcome' and available_delta=3000 and in_play_delta=0 and reservation_id is null and hand_id is null) or
 (kind='reserve' and available_delta<0 and in_play_delta=-available_delta and reservation_id is not null and hand_id is null) or
 (kind='refund' and available_delta>0 and in_play_delta=-available_delta and reservation_id is not null and hand_id is null) or
 (kind='cashout' and available_delta>=0 and in_play_delta=-available_delta and reservation_id is not null and hand_id is null) or
 (kind='settlement' and available_delta=0 and reservation_id is not null and hand_id is not null) or
 (kind='refill' and available_delta>0 and available_delta<=3000 and in_play_delta=0 and reservation_id is null and hand_id is null));

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
 if a.in_play>0 or a.available>=least(smallest,3000) then raise exception 'Refill not needed';end if;
 update poker_private.ring_accounts set available=3000,updated_at=now() where member_id=who;
 insert into poker_private.ring_chip_ledger(member_id,request_id,kind,available_delta,in_play_delta) values(who,p_request,'refill',3000-a.available,0);
 return poker_private.ring_balance();
end;$$;
revoke all on function public.poker_ring_refill(uuid,uuid) from public,anon,service_role;
grant execute on function public.poker_ring_refill(uuid,uuid) to authenticated;
