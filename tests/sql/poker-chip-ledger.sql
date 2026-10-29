-- Staging only. Authentication fixtures and chip changes are rolled back.
begin;
create function pg_temp.expect_rejection(statement text,fragment text) returns void language plpgsql as $$begin
 begin execute statement;exception when others then if position(fragment in sqlerrm)>0 then return;else raise;end if;end;
 raise exception 'Expected rejection: %',fragment;
end;$$;
do $$
declare member uuid:=gen_random_uuid();again uuid:=gen_random_uuid();second_member uuid:=gen_random_uuid();third_member uuid:=gen_random_uuid();unconfirmed uuid:=gen_random_uuid();anonymous_id uuid:=gen_random_uuid();store_id uuid:=gen_random_uuid();blocked uuid:=gen_random_uuid();admin_id uuid:=gen_random_uuid();tid uuid:=gen_random_uuid();request1 uuid:=gen_random_uuid();request2 uuid:=gen_random_uuid();request3 uuid:=gen_random_uuid();refund1 uuid:=gen_random_uuid();email_address text;wallet jsonb;r jsonb;
begin
 email_address:='qa-ledger-'||member||'@example.invalid';
 insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data,created_at,updated_at) values(member,email_address,null,false,'{}',now(),now());
 if exists(select 1 from poker_private.ring_accounts where member_id=member) then raise exception 'Unconfirmed signup funded';end if;
 update auth.users set email_confirmed_at=now() where id=member;
 perform set_config('request.jwt.claim.sub',member::text,true);
 wallet:=public.poker_ring_balance();if (wallet->>'available')::bigint<>3000 then raise exception 'Initial grant failed';end if;
 for n in 1..10 loop perform public.poker_ring_balance();update auth.users set email_confirmed_at=now(),raw_user_meta_data='{"chips":999999,"bonusClaimed":false}' where id=member;end loop;
 if (select available from poker_private.ring_accounts where member_id=member)<>3000 or (select count(*) from poker_private.ring_chip_ledger where member_id=member and kind='welcome')<>1 then raise exception 'Duplicate grant';end if;
 insert into auth.users(id,email,email_confirmed_at,is_anonymous,created_at,updated_at) values(second_member,'qa-'||second_member||'@example.invalid',now(),false,now(),now()),(third_member,'qa-'||third_member||'@example.invalid',now(),false,now(),now()),(anonymous_id,'qa-'||anonymous_id||'@example.invalid',now(),true,now(),now()),(store_id,'qa-'||store_id||'@login.poker-summit.jp',now(),false,now(),now()),(blocked,'qa-'||blocked||'@example.invalid',null,false,now(),now()),(admin_id,'qa-'||admin_id||'@example.invalid',null,false,now(),now());
 insert into public.member_status(user_id,suspended) values(blocked,true);
 insert into public.admin_users(user_id) values(admin_id);
 update auth.users set email_confirmed_at=now() where id in(blocked,admin_id);
 if exists(select 1 from poker_private.ring_welcome_claims where member_id in(anonymous_id,store_id,blocked)) then raise exception 'Ineligible account funded';end if;
 if (select available from poker_private.ring_accounts where member_id=admin_id)<>3000 then raise exception 'Member administrator excluded';end if;
 insert into public.poker_ring_tables(id,title,capacity,sb,bb,min_buy_in,max_buy_in,published) values(tid,'QA temporary escrow',2,50,100,1000,3000,true);
 r:=public.poker_ring_reserve_funds(member,tid,2000,request1);perform public.poker_ring_reserve_funds(member,tid,2000,request1);
 if (select available from poker_private.ring_accounts where member_id=member)<>1000 or (select in_play from poker_private.ring_accounts where member_id=member)<>2000 then raise exception 'Reserve mismatch';end if;
 perform pg_temp.expect_rejection(format('select public.poker_ring_reserve_funds(%L,%L,1000,%L)',member,tid,request1),'Request conflict');
 perform pg_temp.expect_rejection(format('select public.poker_ring_reserve_funds(%L,%L,500,%L)',second_member,tid,gen_random_uuid()),'outside range');
 perform pg_temp.expect_rejection(format('select public.poker_ring_reserve_funds(%L,%L,2000,%L)',member,tid,gen_random_uuid()),'Insufficient');
 perform public.poker_ring_reserve_funds(second_member,tid,2000,request2);
 perform pg_temp.expect_rejection(format('select public.poker_ring_reserve_funds(%L,%L,2000,%L)',third_member,tid,request3),'Table full');
 perform pg_temp.expect_rejection(format('update public.poker_ring_tables set deleted_at=now(),published=false where id=%L',tid),'reserved funds');
 perform public.poker_ring_return_reserved_funds(request1,refund1);perform public.poker_ring_return_reserved_funds(request1,refund1);perform public.poker_ring_return_reserved_funds(request1,gen_random_uuid());
 if (select available from poker_private.ring_accounts where member_id=member)<>3000 or (select in_play from poker_private.ring_accounts where member_id=member)<>0 then raise exception 'Refund mismatch';end if;
 perform public.poker_ring_reserve_funds(member,tid,2000,request3);
 perform pg_temp.expect_rejection(format('select public.poker_ring_return_reserved_funds(%L,%L)',request3,refund1),'Request conflict');
 perform public.poker_ring_return_reserved_funds(request3,gen_random_uuid());
 perform public.poker_ring_return_reserved_funds(request2,gen_random_uuid());
 if (select sum(available+in_play) from poker_private.ring_accounts where member_id in(member,second_member,third_member))<>9000 then raise exception 'Chip supply changed';end if;
 if exists(select 1 from poker_private.ring_accounts a where a.member_id in(member,second_member,third_member) and (a.available<>(select coalesce(sum(available_delta),0) from poker_private.ring_chip_ledger where member_id=a.member_id) or a.in_play<>(select coalesce(sum(in_play_delta),0) from poker_private.ring_chip_ledger where member_id=a.member_id))) then raise exception 'Ledger mismatch';end if;
 perform pg_temp.expect_rejection(format('update poker_private.ring_chip_ledger set available_delta=available_delta where member_id=%L',member),'immutable');
 perform pg_temp.expect_rejection(format('update poker_private.ring_welcome_claims set amount=amount where member_id=%L',member),'immutable');
 insert into public.member_status(user_id,suspended) values(member,true);
 perform pg_temp.expect_rejection(format('select public.poker_ring_reserve_funds(%L,%L,1000,%L)',member,tid,gen_random_uuid()),'Account unavailable');
 update public.member_status set suspended=false where user_id=member;
 -- Removing/recreating the auth identity must not reset the welcome receipt.
 update auth.users set email='qa-retired-'||member||'@example.invalid' where id=member;
 insert into auth.users(id,email,email_confirmed_at,is_anonymous,created_at,updated_at) values(again,email_address,now(),false,now(),now());
 if (select available from poker_private.ring_accounts where member_id=again)<>0 or exists(select 1 from poker_private.ring_welcome_claims where member_id=again) then raise exception 'Re-registration funded twice';end if;
 perform set_config('request.jwt.claim.sub',again::text,true);wallet:=public.poker_ring_balance();if (wallet->>'available')::bigint<>0 then raise exception 'Re-registration lazy grant';end if;
end;$$;
set local role authenticated;
do $$begin
 if has_function_privilege(current_user,'public.poker_ring_reserve_funds(uuid,uuid,bigint,uuid)','EXECUTE') or has_function_privilege(current_user,'public.poker_ring_return_reserved_funds(uuid,uuid)','EXECUTE') then raise exception 'Player funding mutation exposed';end if;
 if has_table_privilege(current_user,'poker_private.ring_chip_ledger','INSERT') or has_table_privilege(current_user,'poker_private.ring_accounts','UPDATE') then raise exception 'Ledger write exposed';end if;
 perform public.poker_ring_balance();
end;$$;
reset role;
set local role anon;
do $$begin if has_function_privilege(current_user,'public.poker_ring_balance()','EXECUTE') then raise exception 'Anonymous wallet exposed';end if;end;$$;
reset role;
rollback;
select 'PASS: verified-only 3000 grant, replays, re-registration, reserve/refund, capacity, conservation, immutable history, ACL (rolled back)' as verification;
