begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $test$
declare
 uid uuid:=gen_random_uuid();
 other uuid:=gen_random_uuid();
 event_id uuid:=gen_random_uuid();
 control_id uuid:=gen_random_uuid();
 visitor uuid:=gen_random_uuid();
 baseline jsonb;
begin
 insert into auth.users(id,email,raw_user_meta_data)
 values(uid,'withdraw-smoke+'||uid||'@example.invalid','{}');
 insert into public.gto_usage_events(id,visitor_id,member_id,tool,action,device) values
 (event_id,visitor,uid,'flop','open','pc'),
 (control_id,visitor,other,'flop','open','mobile');
 select to_jsonb(e)-'member_id' into baseline from public.gto_usage_events e where id=event_id;
 perform private.withdraw_member(uid);
 assert not exists(select 1 from auth.users where id=uid),'test member not deleted';
 assert exists(select 1 from public.gto_usage_events e where id=event_id and member_id is null and to_jsonb(e)-'member_id'=baseline),'usage not anonymized/payload changed';
 assert exists(select 1 from public.gto_usage_events where id=control_id and member_id=other),'control changed';
 assert not has_function_privilege('anon','private.withdraw_member(uuid)','execute'),'anon function access';
 assert not has_function_privilege('authenticated','private.withdraw_member(uuid)','execute'),'member function access';
 assert not has_table_privilege('anon','public.gto_usage_events','select'),'anon usage access';
 assert not has_table_privilege('authenticated','public.gto_usage_events','select'),'member usage access';
 assert has_table_privilege('service_role','public.gto_usage_events','select,insert'),'service role access changed';
end
$test$;
rollback;
select 'passed: production withdrawal anonymized synthetic usage without changing payload/control; all synthetic data rolled back' as result;