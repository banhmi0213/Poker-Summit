-- Run only on the isolated staging project; all fixture rows roll back.
begin;
insert into auth.users(id) values('edce276c-f31d-4a51-a10e-27e67989abe0'),('9fde451d-b7d4-46c4-82cf-c534b36cb779');
insert into public.admin_users(user_id) values('edce276c-f31d-4a51-a10e-27e67989abe0');
insert into public.member_status(user_id,suspended) values('9fde451d-b7d4-46c4-82cf-c534b36cb779',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','edce276c-f31d-4a51-a10e-27e67989abe0',true);
do $$ begin
 if public.is_admin() is not true or public.is_suspended() is not false then raise exception 'Admin self lookup failed'; end if;
 if (select count(*) from public.member_status)<>0 then raise exception 'Member status leaked'; end if;
 begin insert into public.admin_users(user_id) values('9fde451d-b7d4-46c4-82cf-c534b36cb779'); raise exception 'Role escalation allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','9fde451d-b7d4-46c4-82cf-c534b36cb779',true);
do $$ begin
 if public.is_admin() is not false or public.is_suspended() is not true then raise exception 'Suspension self lookup failed'; end if;
 if (select count(*) from public.admin_users)<>0 then raise exception 'Admin roster leaked'; end if;
 if has_function_privilege(current_user,'public.poker_room_startup_ids(integer)','execute') then raise exception 'Private RPC accessible'; end if;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 if public.is_admin() is not false or public.is_suspended() is not false then raise exception 'Anonymous identity lookup failed'; end if;
 if (select count(*) from public.admin_users)<>0 or (select count(*) from public.member_status)<>0 or (select count(*) from public.stores)<>0 then raise exception 'Anonymous foundation rows leaked'; end if;
 perform id from public.poker_tournaments limit 1;
end $$;
reset role;
rollback;
select jsonb_build_object('accounts',(select count(*) from auth.users),'tournaments',(select count(*) from public.poker_tournaments),'startup_rooms',public.poker_room_startup_ids(16)) as after_rollback;
