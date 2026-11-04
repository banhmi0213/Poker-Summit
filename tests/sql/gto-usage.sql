-- Run on staging only. All fixture rows are rolled back.
begin;
do $$
declare n bigint;
begin
 if not (select relrowsecurity from pg_class where oid='public.gto_usage_events'::regclass) then raise exception 'RLS disabled'; end if;
 if has_table_privilege('anon','public.gto_usage_events','select') or has_table_privilege('anon','public.gto_usage_events','insert') or has_table_privilege('authenticated','public.gto_usage_events','select') or has_table_privilege('authenticated','public.gto_usage_events','insert') then raise exception 'Browser table privileges leaked'; end if;
 insert into public.gto_usage_events(id,visitor_id,tool,action,device) values ('d0110000-0000-4000-8000-000000000001','d0110000-0000-4000-8000-000000000002','quiz','answer','mobile');
 insert into public.gto_usage_events(id,visitor_id,tool,action,device) values ('d0110000-0000-4000-8000-000000000001','d0110000-0000-4000-8000-000000000002','quiz','answer','mobile') on conflict(id) do nothing;
 select count(*) into n from public.gto_usage_events where id='d0110000-0000-4000-8000-000000000001';
 if n<>1 then raise exception 'Duplicate event rows'; end if;
 begin
  insert into public.gto_usage_events(id,visitor_id,tool,action,device) values (gen_random_uuid(),gen_random_uuid(),'invalid','answer','mobile');
  raise exception 'Invalid tool accepted';
 exception when check_violation then null; end;
end $$;
rollback;
