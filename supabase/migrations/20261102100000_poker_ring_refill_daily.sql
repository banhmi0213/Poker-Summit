-- 補充は1日1回(オーナー 2026/11/01)。リング公開時は全員 1/2 の100BB(200 chip)まで戻す。
-- 段位を出すとき(20261102090000_poker_ring_ranks 以降)に、段位ごとの額(200・500・1,000・2,000)へ切り替える。
-- 卓に座っていない、かつ残高が200より少ないときだけ。毎月1日の配布(1,000)は別。
begin;
create or replace function public.poker_ring_refill(p_request uuid,p_table uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();a poker_private.ring_accounts%rowtype;amount constant bigint:=200;
begin
 if who is null or p_request is null or coalesce(public.is_suspended(),true) or not poker_private.ring_member_eligible(who) then raise exception 'Login required';end if;
 perform poker_private.ensure_ring_welcome(who);
 perform poker_private.ensure_ring_season(who);
 select * into a from poker_private.ring_accounts where member_id=who for update;
 if not found then raise exception 'Account unavailable';end if;
 if exists(select 1 from poker_private.ring_chip_ledger where member_id=who and request_id=p_request) then return poker_private.ring_balance();end if;
 if p_table is not null and not exists(select 1 from public.poker_ring_tables where id=p_table and published and deleted_at is null) then raise exception 'Table unavailable';end if;
 if a.in_play>0 or a.available>=amount then raise exception 'Refill not needed';end if;
 update poker_private.ring_accounts set available=amount,updated_at=now() where member_id=who;
 insert into poker_private.ring_chip_ledger(member_id,request_id,kind,available_delta,in_play_delta) values(who,p_request,'refill',amount-a.available,0);
 return poker_private.ring_balance();
end;$$;
revoke all on function public.poker_ring_refill(uuid,uuid) from public,anon,service_role;
grant execute on function public.poker_ring_refill(uuid,uuid) to authenticated;

create or replace function poker_private.ring_ledger_throttle() returns trigger language plpgsql set search_path='' as $$
begin
 if new.kind='reserve' and (select count(*) from poker_private.ring_chip_ledger l where l.member_id=new.member_id and l.kind='reserve' and l.created_at>now()-interval '1 hour')>=30 then
  raise exception 'Too many seat changes' using hint='着席の回数が多すぎます。しばらく時間をおいてください。';
 end if;
 if new.kind='refill' and (select count(*) from poker_private.ring_chip_ledger l where l.member_id=new.member_id and l.kind='refill'
    and l.created_at>=(date_trunc('day',now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo'))>=1 then
  raise exception 'Refill limit reached' using hint='補充は1日1回までです。';
 end if;
 return new;
end; $$;

-- 確認画面用: 今日の補充を使ったか・補充の額(段位を出したら poker_ring_rank が返す)。
create or replace function public.poker_ring_refill_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if who is null then raise exception 'Login required';end if;
 return jsonb_build_object('refillAmount',200,'refillUsedToday',exists(select 1 from poker_private.ring_chip_ledger l where l.member_id=who and l.kind='refill'
   and l.created_at>=(date_trunc('day',now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo')));
end;$$;
revoke all on function public.poker_ring_refill_status() from public,anon;
grant execute on function public.poker_ring_refill_status() to authenticated;
commit;
