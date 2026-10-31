-- リングのレーキを卓ごとに(オーナー 2026/10/31：レーキごとに1卓ずつ)。選べるのはGTOの表がある3種類だけ
-- (3%・上限3BB／5%・上限5BB／10%・上限10BB)。卓の決まりはハンドを始めるときにそのハンドの条件(terms)に記録し、
-- 精算のチェック(上限)とハンド履歴(GTOの判定で使う表)はそのハンドの記録を使う。それより前のハンドは3%・3BBとして扱う。
alter table public.poker_ring_tables add column if not exists rake_bps integer not null default 300;
alter table public.poker_ring_tables add column if not exists rake_cap_bb integer not null default 3;
alter table public.poker_ring_tables drop constraint if exists poker_ring_tables_rake_check;
alter table public.poker_ring_tables add constraint poker_ring_tables_rake_check check((rake_bps,rake_cap_bb) in ((300,3),(500,5),(1000,10)));

create or replace function poker_private.ring_context(p_table uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.poker_ring_tables%rowtype; seats jsonb;
begin
 select * into t from public.poker_ring_tables where id=p_table;
 if not found then raise exception 'Table unavailable';end if;
 select coalesce(jsonb_agg(jsonb_build_object('reservationId',id,'memberId',member_id,'seat',seat_number,'stack',table_stack) order by seat_number),'[]'::jsonb) into seats from poker_private.ring_fund_reservations where table_id=p_table and status='seated';
 return jsonb_build_object('tableId',t.id,'capacity',t.capacity,'terms',jsonb_build_object('sb',t.sb,'bb',t.bb,'rakeBps',t.rake_bps,'rakeCapBb',t.rake_cap_bb),'seats',seats,'published',t.published and t.deleted_at is null,'buttonSeat',coalesce((select min(seat_number) from poker_private.ring_fund_reservations where table_id=p_table and status='seated' and seat_number>coalesce((select button_seat from poker_private.ring_hands where table_id=p_table order by created_at desc,id desc limit 1),0)),(select min(seat_number) from poker_private.ring_fund_reservations where table_id=p_table and status='seated')),'activeHandId',(select id from poker_private.ring_hands where table_id=p_table and status='active'));
end;$$;

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
end;$function$;

create or replace function poker_private.admin_ring_save(p_id uuid,p_expected bigint,p_settings jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row public.poker_ring_tables%rowtype; v_id uuid;
begin
 if auth.uid() is null or not coalesce(public.is_admin(),false) or coalesce(public.is_suspended(),true) then raise exception 'Admin required'; end if;
 if jsonb_typeof(p_settings) is distinct from 'object' then raise exception 'Invalid settings'; end if;
 if p_id is not null then
  select * into row from public.poker_ring_tables where id=p_id for update;
  if not found or row.deleted_at is not null then raise exception 'Table not found'; end if;
  if row.revision is distinct from p_expected then raise exception 'Settings changed; reload'; end if;
 else
  if p_expected is distinct from 0 then raise exception 'Invalid new table revision'; end if;
 end if;
 v_id:=coalesce(p_id,gen_random_uuid());
 insert into public.poker_ring_tables(id,title,capacity,sb,bb,min_buy_in,max_buy_in,note,published,sort_order,rake_bps,rake_cap_bb)
 values(v_id,btrim(p_settings->>'title'),(p_settings->>'capacity')::smallint,(p_settings->>'sb')::integer,(p_settings->>'bb')::integer,
 (p_settings->>'min_buy_in')::integer,(p_settings->>'max_buy_in')::integer,coalesce(p_settings->>'note',''),(p_settings->>'published')::boolean,(p_settings->>'sort_order')::integer,
 coalesce((p_settings->>'rake_bps')::integer,300),coalesce((p_settings->>'rake_cap_bb')::integer,3))
 on conflict(id) do update set title=excluded.title,capacity=excluded.capacity,sb=excluded.sb,bb=excluded.bb,min_buy_in=excluded.min_buy_in,max_buy_in=excluded.max_buy_in,note=excluded.note,published=excluded.published,sort_order=excluded.sort_order,rake_bps=excluded.rake_bps,rake_cap_bb=excluded.rake_cap_bb,revision=public.poker_ring_tables.revision+1,updated_at=now();
 select * into row from public.poker_ring_tables where id=v_id;
 return to_jsonb(row);
end;$$;

create or replace function poker_private.hand_history_view(h poker_private.hand_histories,who uuid,p_admin boolean) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'handId',h.hand_id,'kind',h.kind,'title',poker_private.hand_history_title(h.kind,h.source_id),
  'handNumber',h.hand_number,'playedAt',h.played_at,'terms',h.record->'terms','buttonSeatId',h.record->'buttonSeatId',
  'board',h.record->'board','actions',h.record->'actions','result',h.record->'result','rake',h.record->'rake',
  'players',(select jsonb_agg(
     jsonb_build_object('seatId',p->>'seatId','seat',(p->>'seat')::integer,'position',p->>'position',
      'name',coalesce(nullif(u.raw_user_meta_data->>'display_name',''),'会員'),
      'startStack',p->'startStack','endStack',p->'endStack','net',p->'net','folded',p->'folded','shown',p->'shown',
      'you',(p->>'memberId')=who::text,
      'hole',case when p_admin or (p->>'memberId')=who::text or (p->>'shown')::boolean then p->'hole' else null end)
     ||case when p_admin then jsonb_build_object('memberId',p->>'memberId') else '{}'::jsonb end
     order by (p->>'seat')::integer)
   from jsonb_array_elements(h.record->'players') p left join auth.users u on u.id::text=p->>'memberId'));
$$;
