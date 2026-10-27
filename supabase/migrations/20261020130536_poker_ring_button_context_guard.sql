begin;
create or replace function poker_private.ring_hand_begin(p_table uuid,p_hand uuid,p_roster jsonb,p_terms jsonb,p_sealed jsonb,p_result jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare ctx jsonb;fingerprint bytea;receipt poker_private.ring_hand_commits%rowtype;
begin
 if p_hand is null then raise exception 'Invalid hand';end if;
 perform 1 from public.poker_ring_tables where id=p_table for update;
 perform poker_private.ring_validate_sealed(p_sealed);
 fingerprint:=extensions.digest(convert_to(jsonb_build_array('begin',p_table,p_roster,p_terms,p_sealed,p_result)::text,'UTF8'),'sha256');
 select * into receipt from poker_private.ring_hand_commits where hand_id=p_hand and request_id=p_hand;
 if found then if receipt.fingerprint<>fingerprint then raise exception 'Request conflict';end if;return receipt.version;end if;
 ctx:=poker_private.ring_context(p_table);
 if not (ctx->>'published')::boolean or ctx->>'activeHandId' is not null then raise exception 'Table unavailable';end if;
 if p_roster is null or p_terms is null or p_roster<>ctx->'seats' or (p_terms-'buttonSeat')<>ctx->'terms' or p_terms->>'buttonSeat' is distinct from ctx->>'buttonSeat' or jsonb_array_length(p_roster)<2 then raise exception 'Seating changed';end if;
 if exists(select 1 from jsonb_array_elements(p_roster) v where (v->>'stack')::bigint<1 or not poker_private.ring_member_eligible((v->>'memberId')::uuid)) then raise exception 'Player unavailable';end if;
 insert into poker_private.ring_hands(id,table_id,version,button_seat,participants,terms,sealed,status) values(p_hand,p_table,1,(ctx->>'buttonSeat')::integer,p_roster,p_terms-'buttonSeat',p_sealed,'active');
 perform poker_private.ring_apply_result(p_hand,p_hand,p_result);
 insert into poker_private.ring_hand_commits(hand_id,request_id,version,fingerprint) values(p_hand,p_hand,1,fingerprint);
 return 1;
end;$$;

commit;
