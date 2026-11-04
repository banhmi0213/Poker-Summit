-- リングのチップ追加(オーナー 2026/11/04)：座ったまま持ち点を足す。
-- 1) ハンド中に頼んだら、そのハンドの精算のあと(次のハンドから)に足す。 2) 上限はそのテーブルの最大持ち込み額。
-- 3)「自動で最大まで」：持ち点が最大持ち込み額より減ったら、ハンドごとに最大まで戻す(残高の範囲で)。
alter table poker_private.ring_fund_reservations add column if not exists topup_pending bigint check(topup_pending is null or topup_pending>0);
alter table poker_private.ring_fund_reservations add column if not exists auto_topup boolean not null default false;

alter table poker_private.ring_chip_ledger drop constraint if exists ring_chip_ledger_kind_check;
alter table poker_private.ring_chip_ledger add constraint ring_chip_ledger_kind_check check(kind in('welcome','reserve','refund','settlement','cashout','refill','reset','topup'));
alter table poker_private.ring_chip_ledger drop constraint if exists ring_chip_ledger_check;
alter table poker_private.ring_chip_ledger add constraint ring_chip_ledger_check check((((kind = 'welcome'::text) AND (available_delta = ANY (ARRAY[(1000)::bigint, (3000)::bigint])) AND (in_play_delta = 0) AND (reservation_id IS NULL) AND (hand_id IS NULL)) OR ((kind = 'reserve'::text) AND (available_delta < 0) AND (in_play_delta = (- available_delta)) AND (reservation_id IS NOT NULL) AND (hand_id IS NULL)) OR ((kind = 'refund'::text) AND (available_delta > 0) AND (in_play_delta = (- available_delta)) AND (reservation_id IS NOT NULL) AND (hand_id IS NULL)) OR ((kind = 'cashout'::text) AND (available_delta >= 0) AND (in_play_delta = (- available_delta)) AND (reservation_id IS NOT NULL) AND (hand_id IS NULL)) OR ((kind = 'settlement'::text) AND (available_delta = 0) AND (reservation_id IS NOT NULL) AND (hand_id IS NOT NULL)) OR ((kind = 'refill'::text) AND (available_delta > 0) AND (available_delta <= 3000) AND (in_play_delta = 0) AND (reservation_id IS NULL) AND (hand_id IS NULL)) OR ((kind = 'reset'::text) AND (in_play_delta = 0) AND (reservation_id IS NULL) AND (hand_id IS NULL)) OR ((kind = 'topup'::text) AND (available_delta < 0) AND (in_play_delta = (- available_delta)) AND (reservation_id IS NOT NULL) AND (hand_id IS NULL))));

-- 足せる分を今すぐ足す(テーブルの行ロックの中で呼ぶ)。足した額を返す。
create or replace function poker_private.ring_topup_apply(p_reservation uuid) returns bigint language plpgsql security definer set search_path='' as $$
declare r poker_private.ring_fund_reservations%rowtype;t public.poker_ring_tables%rowtype;a poker_private.ring_accounts%rowtype;room bigint;want bigint;add bigint;
begin
 select * into r from poker_private.ring_fund_reservations where id=p_reservation for update;
 if not found or r.status<>'seated' or r.exit_request is not null or (r.topup_pending is null and not r.auto_topup) then
  if found and r.topup_pending is not null and r.status<>'seated' then update poker_private.ring_fund_reservations set topup_pending=null where id=r.id;end if;
  return 0;
 end if;
 if exists(select 1 from poker_private.ring_hands h where h.table_id=r.table_id and h.status='active' and h.participants @> jsonb_build_array(jsonb_build_object('reservationId',r.id::text))) then return 0;end if;
 select * into t from public.poker_ring_tables where id=r.table_id;
 select * into a from poker_private.ring_accounts where member_id=r.member_id for update;
 room:=greatest(0,t.max_buy_in-r.table_stack);
 want:=greatest(coalesce(r.topup_pending,0),case when r.auto_topup then room else 0 end);
 add:=least(want,room,greatest(a.available,0));
 update poker_private.ring_fund_reservations set topup_pending=null where id=r.id and topup_pending is not null;
 if add<=0 then return 0;end if;
 update poker_private.ring_accounts set available=available-add,in_play=in_play+add,updated_at=now() where member_id=r.member_id;
 update poker_private.ring_fund_reservations set table_stack=table_stack+add where id=r.id;
 insert into poker_private.ring_chip_ledger(member_id,request_id,kind,reservation_id,available_delta,in_play_delta) values(r.member_id,gen_random_uuid(),'topup',r.id,-add,add);
 return add;
end;$$;
revoke all on function poker_private.ring_topup_apply(uuid) from public,anon,authenticated;

create or replace function poker_private.ring_topup_view(r poker_private.ring_fund_reservations) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('reservationId',r.id,'stack',r.table_stack,'pending',r.topup_pending,'auto',r.auto_topup,
  'maxBuyIn',t.max_buy_in,'available',(select available from poker_private.ring_accounts where member_id=r.member_id),
  'inHand',exists(select 1 from poker_private.ring_hands h where h.table_id=r.table_id and h.status='active' and h.participants @> jsonb_build_array(jsonb_build_object('reservationId',r.id::text))))
 from public.poker_ring_tables t where t.id=r.table_id;
$$;
revoke all on function poker_private.ring_topup_view(poker_private.ring_fund_reservations) from public,anon,authenticated;

-- 自分の着席中の席の、追加の状態。
create or replace function public.poker_ring_topup_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=auth.uid();r poker_private.ring_fund_reservations%rowtype;
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required';end if;
 select * into r from poker_private.ring_fund_reservations where member_id=who and status='seated' limit 1;
 if not found then return null;end if;
 return poker_private.ring_topup_view(r);
end;$$;
revoke all on function public.poker_ring_topup_status() from public,anon;
grant execute on function public.poker_ring_topup_status() to authenticated;

-- 足す(p_amount>0)・自動の切り替え(p_auto)。ハンド中なら次のハンドから。
create or replace function public.poker_ring_topup(p_reservation uuid,p_amount bigint,p_auto boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();r poker_private.ring_fund_reservations%rowtype;t public.poker_ring_tables%rowtype;a poker_private.ring_accounts%rowtype;
begin
 if who is null or coalesce(public.is_suspended(),true) or not poker_private.ring_member_eligible(who) then raise exception 'Login required';end if;
 select * into r from poker_private.ring_fund_reservations where id=p_reservation;
 if not found or r.member_id<>who or r.status<>'seated' then raise exception 'Seat unavailable';end if;
 perform 1 from public.poker_ring_tables where id=r.table_id for update;
 select * into r from poker_private.ring_fund_reservations where id=p_reservation for update;
 if r.status<>'seated' or r.exit_request is not null then raise exception 'Seat unavailable';end if;
 select * into t from public.poker_ring_tables where id=r.table_id;
 select * into a from poker_private.ring_accounts where member_id=who for update;
 if p_amount is not null then
  if p_amount<1 then raise exception 'Invalid amount';end if;
  if p_amount>greatest(0,t.max_buy_in-r.table_stack) then raise exception 'Above max buy-in' using hint='最大持ち込み額までしか足せません。';end if;
  if p_amount>a.available then raise exception 'Insufficient chips' using hint='持ちチップが足りません。';end if;
 end if;
 update poker_private.ring_fund_reservations set auto_topup=coalesce(p_auto,auto_topup),topup_pending=coalesce(p_amount,topup_pending) where id=r.id;
 perform poker_private.ring_topup_apply(r.id);
 select * into r from poker_private.ring_fund_reservations where id=p_reservation;
 return poker_private.ring_topup_view(r);
end;$$;
revoke all on function public.poker_ring_topup(uuid,bigint,boolean) from public,anon;
grant execute on function public.poker_ring_topup(uuid,bigint,boolean) to authenticated;

create or replace function poker_private.ring_apply_result(p_hand uuid, p_write uuid, p_result jsonb)
 returns void language plpgsql set search_path to '' as $function$
declare h poker_private.ring_hands%rowtype;entry jsonb;value jsonb;r poker_private.ring_fund_reservations%rowtype;
 total_before numeric:=0;total_after numeric:=0;total_rake numeric:=0;new_stack bigint;paid bigint;cap numeric;
begin
 if p_result is null then return;end if;
 select * into h from poker_private.ring_hands where id=p_hand;
 if h.status<>'active' or jsonb_typeof(p_result) is distinct from 'array' or jsonb_array_length(p_result)<>jsonb_array_length(h.participants) then raise exception 'Invalid hand result';end if;
 if exists(select 1 from jsonb_array_elements(p_result) v where jsonb_typeof(v) is distinct from 'object' or jsonb_typeof(v->'stack') is distinct from 'number' or (v->>'stack')!~'^[0-9]+$'
   or (v ? 'rake' and (jsonb_typeof(v->'rake') is distinct from 'number' or (v->>'rake')!~'^[0-9]+$')))
  or (select count(distinct v->>'reservationId') from jsonb_array_elements(p_result) v)<>jsonb_array_length(p_result) then raise exception 'Invalid hand result';end if;
 perform 1 from poker_private.ring_accounts where member_id in(select (v->>'memberId')::uuid from jsonb_array_elements(h.participants) v) order by member_id for update;
 for entry in select * from jsonb_array_elements(h.participants) loop
  select v into value from jsonb_array_elements(p_result) v where v->>'reservationId'=entry->>'reservationId';
  if value is null then raise exception 'Participant mismatch';end if;
  new_stack:=(value->>'stack')::bigint;paid:=coalesce((value->>'rake')::bigint,0);
  if new_stack<0 or new_stack>4503599627370495 or paid<0 then raise exception 'Invalid hand result';end if;
  select * into r from poker_private.ring_fund_reservations where id=(entry->>'reservationId')::uuid for update;
  if r.status<>'seated' or r.table_id<>h.table_id or r.member_id<>(entry->>'memberId')::uuid or r.table_stack<>(entry->>'stack')::bigint or (select in_play from poker_private.ring_accounts where member_id=r.member_id)<>r.table_stack then raise exception 'Accounting mismatch';end if;
  total_before:=total_before+r.table_stack;total_after:=total_after+new_stack;total_rake:=total_rake+paid;
 end loop;
 -- The hand's own table rule (recorded in its terms when it began); hands begun before 2026/10/31 used 3BB.
 cap:=coalesce((h.terms->>'rakeCapBb')::numeric,3)*coalesce((h.terms->>'bb')::numeric,0);
 if total_rake<0 or total_rake>cap then raise exception 'Invalid rake';end if;
 if total_before<>total_after+total_rake then raise exception 'Chip total changed';end if;
 for entry in select * from jsonb_array_elements(h.participants) loop
  select v into value from jsonb_array_elements(p_result) v where v->>'reservationId'=entry->>'reservationId';new_stack:=(value->>'stack')::bigint;paid:=coalesce((value->>'rake')::bigint,0);
  update poker_private.ring_accounts set in_play=new_stack,updated_at=now() where member_id=(entry->>'memberId')::uuid;
  update poker_private.ring_fund_reservations set table_stack=new_stack where id=(entry->>'reservationId')::uuid;
  insert into poker_private.ring_chip_ledger(member_id,request_id,kind,reservation_id,hand_id,available_delta,in_play_delta) values((entry->>'memberId')::uuid,p_write,'settlement',(entry->>'reservationId')::uuid,p_hand,0,new_stack-(entry->>'stack')::bigint);
  if paid>0 then
   insert into poker_private.ring_rake(hand_id,table_id,reservation_id,member_id,amount) values(p_hand,h.table_id,(entry->>'reservationId')::uuid,(entry->>'memberId')::uuid,paid);
  end if;
 end loop;
 update poker_private.ring_hands set status='complete',result=p_result,completed_at=now() where id=p_hand;
 -- チップの追加(2026/11/04)：ハンド中に頼まれた分と「自動で最大まで」を、このハンドの精算のあとに足す(次のハンドから)。
 for entry in select * from jsonb_array_elements(h.participants) loop
  perform poker_private.ring_topup_apply((entry->>'reservationId')::uuid);
 end loop;
end;$function$;
