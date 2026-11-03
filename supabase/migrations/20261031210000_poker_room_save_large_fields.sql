-- 大会の最後のハンドの記録が大きすぎて保存できず、100人の大会がファイナルで止まる不具合の修正(2026/10/31)。
-- 最後のハンドの結果には、参加者全員(会員IDと entry id)と全員の順位が入る。10,000文字の上限では60人ほどで超えてしまい、
-- 優勝が決まる保存が拒否されて卓が止まっていた。200人分(約3万文字)に十分な300,000文字まで広げる。ほかの検査は同じ。
create or replace function public.poker_room_save(p_room uuid,p_expected bigint,p_write uuid,p_sealed jsonb,p_result jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare current_row poker_private.room_checkpoints%rowtype; existing_result jsonb; h uuid;
begin
 if p_room is null or p_write is null or p_expected is null or p_expected<0 or p_expected>=9007199254740991
    or p_sealed is null or jsonb_typeof(p_sealed)<>'object'
    or (p_sealed->>'format') is distinct from '1'
    or coalesce(length(p_sealed->>'data'),0)<1 or length(p_sealed::text)>3000000
    or coalesce(length(p_sealed->>'iv'),0)<>16 or coalesce(length(p_sealed->>'tag'),0)<>24
    or coalesce(p_sealed->>'keyId','') !~ '^[a-zA-Z0-9_-]{1,80}$' then
   raise exception 'Invalid checkpoint';
 end if;
 if p_result is not null and (jsonb_typeof(p_result)<>'object' or p_result->>'handId' is null
    or jsonb_typeof(p_result->'payouts') is distinct from 'object'
    or jsonb_typeof(p_result->'winners') is distinct from 'array' or length(p_result::text)>300000) then
   raise exception 'Invalid terminal result';
 end if;
 -- The insert and row lock serialize initial creation as well as existing owners.
 if p_expected=0 then
   insert into poker_private.room_checkpoints(room_id,version,write_id,sealed)
     values(p_room,0,p_write,p_sealed) on conflict(room_id) do nothing;
 end if;
 select * into current_row from poker_private.room_checkpoints where room_id=p_room for update;
 if not found then raise exception 'Checkpoint conflict'; end if;
 if current_row.version=p_expected+1 and current_row.write_id=p_write
    and current_row.sealed=p_sealed and current_row.last_result is not distinct from p_result then
   return current_row.version; -- lost response retry: no duplicate log or award
 end if;
 if current_row.version<>p_expected or (current_row.version>0 and current_row.write_id=p_write) then
   raise exception 'Checkpoint conflict';
 end if;
 if p_result is not null then
   h=(p_result->>'handId')::uuid;
   insert into poker_private.hand_results(room_id,hand_id,result) values(p_room,h,p_result)
     on conflict(room_id,hand_id) do nothing;
   select result into existing_result from poker_private.hand_results where room_id=p_room and hand_id=h;
   if existing_result is distinct from p_result then
     -- One-way enrichment of legacy records with server-owned seat/member mapping.
     if not (existing_result ? 'participants') and p_result ? 'participants'
        and existing_result = p_result - 'participants' then
       update poker_private.hand_results set result=p_result where room_id=p_room and hand_id=h;
     else raise exception 'Terminal result conflict'; end if;
   end if;
 end if;
 update poker_private.room_checkpoints set version=p_expected+1,write_id=p_write,sealed=p_sealed,
   last_result=p_result,updated_at=now() where room_id=p_room;
 return p_expected+1;
end;
$$;
