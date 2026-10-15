begin;
do $test$
declare
 admin_id uuid; owner_id uuid; store_id uuid; stranger uuid:=gen_random_uuid();
 test_id uuid:=gen_random_uuid(); global_id uuid:=gen_random_uuid(); n integer; checks integer:=0;
 cfg jsonb:='{"startingStack":10000,"anteType":"bb","lateRegLevel":1,"reentry":false,"periods":[{"kind":"level","minutes":20,"sb":50,"bb":100,"ante":0,"note":""}]}'::jsonb;
begin
 select user_id into admin_id from public.admin_users where active limit 1;
 select s.id,s.owner_user_id into store_id,owner_id from public.stores s
 where s.owner_user_id is not null
 and not exists(select 1 from public.admin_users a where a.user_id=s.owner_user_id and a.active)
 and not exists(select 1 from public.member_status m where m.user_id=s.owner_user_id and m.suspended) limit 1;
 if admin_id is null or owner_id is null then raise exception 'Missing eligible test actors'; end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 execute 'set local role authenticated';
 insert into public.poker_tournaments(id,owner_store_id,title,starts_at,structure)
 values(test_id,store_id,'__transaction_test__',now()+interval '1 day',cfg);
 select count(*) into n from public.poker_tournaments where id=test_id;
 if n<>1 then raise exception 'Owner save failed'; end if; checks:=checks+1;
 update public.poker_tournaments set title='__updated_transaction_test__' where id=test_id;
 get diagnostics n=row_count; if n<>1 then raise exception 'Owner update failed';end if;checks:=checks+1;
 perform set_config('request.jwt.claim.sub',stranger::text,true);
 select count(*) into n from public.poker_tournaments where id=test_id;
 if n<>0 then raise exception 'Draft leaked';end if;checks:=checks+1;
 update public.poker_tournaments set title='forbidden' where id=test_id;
 get diagnostics n=row_count;if n<>0 then raise exception 'Cross owner update allowed';end if;checks:=checks+1;
 begin
  insert into public.poker_tournaments(owner_store_id,title,starts_at,structure)
  values(store_id,'forbidden',now(),cfg);
  raise exception 'Cross owner insert allowed';
 exception when insufficient_privilege then checks:=checks+1;
 end;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 update public.poker_tournaments set published=true where id=test_id;
 get diagnostics n=row_count;if n<>1 then raise exception 'Publish failed';end if;checks:=checks+1;
 execute 'set local role anon';
 perform set_config('request.jwt.claim.sub','',true);
 select count(*) into n from public.poker_tournaments where id=test_id;
 if n<>1 then raise exception 'Public read failed';end if;checks:=checks+1;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 insert into public.poker_tournaments(id,title,starts_at,structure)
 values(global_id,'__admin_transaction_test__',now(),cfg);
 select count(*) into n from public.poker_tournaments where id in(test_id,global_id);
 if n<>2 then raise exception 'Admin read failed';end if;checks:=checks+1;
 update public.poker_tournaments set published=false where id=test_id;
 get diagnostics n=row_count;if n<>1 then raise exception 'Admin update failed';end if;checks:=checks+1;
 execute 'set local role anon';
 perform set_config('request.jwt.claim.sub','',true);
 select count(*) into n from public.poker_tournaments where id in(test_id,global_id);
 if n<>0 then raise exception 'Unpublish failed';end if;checks:=checks+1;
 perform set_config('poker.test_report',jsonb_build_object('assertions',checks,'owner_save_update','passed','cross_owner_restrictions','passed','draft_privacy','passed','publish_unpublish','passed','admin_save_update','passed','cleanup','ROLLBACK follows')::text,true);
end;
$test$;
select current_setting('poker.test_report')::jsonb as test_result;
rollback;
