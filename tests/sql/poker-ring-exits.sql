begin;
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();tid uuid:=gen_random_uuid();ra uuid:=gen_random_uuid();rb uuid:=gen_random_uuid();ea uuid:=gen_random_uuid();eb uuid:=gen_random_uuid();hid uuid:=gen_random_uuid();write_id uuid:=gen_random_uuid();next_seat uuid:=gen_random_uuid();ctx jsonb;state jsonb;before_ledger bigint;
sealed jsonb:='{"format":1,"keyId":"fixture","iv":"AAAAAAAAAAAAAAAA","tag":"AAAAAAAAAAAAAAAAAAAAAA==","data":"fixture"}';
begin
 insert into auth.users(id,email,email_confirmed_at) values(a,'exit-'||a||'@example.invalid',now()),(b,'exit-'||b||'@example.invalid',now());
 insert into public.poker_ring_tables(id,title,capacity,sb,bb,min_buy_in,max_buy_in,published) values(tid,'Deferred exit fixture',2,50,100,1000,3000,true);
 perform public.poker_ring_admit(a,tid,1000,ra);perform public.poker_ring_admit(b,tid,2000,rb);
 ctx:=public.poker_ring_context(tid);
 perform public.poker_ring_hand_begin(tid,hid,ctx->'seats',ctx->'terms'||jsonb_build_object('buttonSeat',ctx->'buttonSeat'),sealed,null);
 begin perform public.poker_ring_depart(b,ra,gen_random_uuid());raise exception 'Ownership bypass';exception when others then if sqlerrm='Ownership bypass' then raise;end if;end;
 state:=public.poker_ring_depart(a,ra,ea);
 if not (state->'membership'->>'exitRequested')::boolean or (state->'wallet'->>'available')::bigint<>2000 then raise exception 'Exit did not preserve active stack';end if;
 perform public.poker_ring_depart(a,ra,ea);perform public.poker_ring_depart(a,ra,gen_random_uuid());
 if (select exit_request from poker_private.ring_fund_reservations where id=ra)<>ea then raise exception 'Retry replaced exit receipt';end if;
 perform public.poker_ring_depart(b,rb,eb);
 -- Reject a non-conserved result without returning either player's chips.
 begin perform public.poker_ring_hand_write(hid,1,gen_random_uuid(),sealed,jsonb_build_array(jsonb_build_object('reservationId',ra,'stack',4000),jsonb_build_object('reservationId',rb,'stack',0)));raise exception 'Invalid settlement accepted';exception when others then if sqlerrm='Invalid settlement accepted' then raise;end if;end;
 if (select count(*) from poker_private.ring_fund_reservations where table_id=tid and status='seated')<>2 then raise exception 'Failed result returned funds';end if;
 -- One player wins all 3,000; the other cashes out zero. Both queued exits must
 -- complete atomically with the durable final result, without a browser request.
 perform public.poker_ring_hand_write(hid,1,write_id,sealed,jsonb_build_array(jsonb_build_object('reservationId',ra,'stack',3000),jsonb_build_object('reservationId',rb,'stack',0)));
 if exists(select 1 from poker_private.ring_fund_reservations where table_id=tid and status<>'returned') then raise exception 'Queued exit not completed';end if;
 if (select available from poker_private.ring_accounts where member_id=a)<>5000 or (select available from poker_private.ring_accounts where member_id=b)<>1000 or exists(select 1 from poker_private.ring_accounts where member_id in(a,b) and in_play<>0) then raise exception 'Final-stack cashout incorrect';end if;
 select count(*) into before_ledger from poker_private.ring_chip_ledger where member_id in(a,b);
 perform public.poker_ring_hand_write(hid,1,write_id,sealed,jsonb_build_array(jsonb_build_object('reservationId',ra,'stack',3000),jsonb_build_object('reservationId',rb,'stack',0)));
 perform public.poker_ring_depart(a,ra,ea);perform public.poker_ring_depart(b,rb,eb);
 if (select count(*) from poker_private.ring_chip_ledger where member_id in(a,b))<>before_ledger then raise exception 'Retry duplicated accounting';end if;
 perform public.poker_ring_admit(a,tid,1000,next_seat);perform public.poker_ring_depart(a,ra,ea);
 state:=public.poker_ring_lobby_state(a,tid);
 if state->'membership'->>'reservationId'<>next_seat::text or (state->'membership'->>'exitRequested')::boolean then raise exception 'Old exit affected new seat';end if;
 perform public.poker_ring_depart(a,next_seat,gen_random_uuid());
 if (select sum(available+in_play) from poker_private.ring_accounts where member_id in(a,b))<>6000 then raise exception 'Chips changed';end if;
end;$$;
set local role authenticated;
do $$begin if has_function_privilege(current_user,'poker_private.ring_finish_exits()','execute') then raise exception 'Public can run exit settlement';end if;end;$$;
reset role;
rollback;
