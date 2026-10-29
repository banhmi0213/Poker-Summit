-- Ring rake (owner 2026/10/29): 3% of the contested pot, at most 3 big blinds, ring tables only, no flop no drop.
-- The game server works the rake out and sends, for each seat, its new stack and the chips it paid as rake.
-- The database still checks every chip: stacks before = stacks after + rake, rake is never negative and at most 3 BB,
-- and each paid chip is written to the house rake ledger (one row per seat per hand; a repeated write cannot add more).

create table if not exists poker_private.ring_rake(
 id bigint generated always as identity primary key,
 hand_id uuid not null references poker_private.ring_hands(id) on delete restrict,
 table_id uuid not null,
 reservation_id uuid not null,
 member_id uuid not null,
 amount bigint not null check(amount>0),
 created_at timestamptz not null default now(),
 unique(hand_id,reservation_id)
);
alter table poker_private.ring_rake enable row level security;
revoke all on table poker_private.ring_rake from public,anon,authenticated,service_role;
-- The operators read the house total with the service role (like ring_hands); nobody else sees it.
grant select on poker_private.ring_rake to service_role;

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
 cap:=3*coalesce((h.terms->>'bb')::numeric,0);
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
end;$function$;
revoke all on function poker_private.ring_apply_result(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
