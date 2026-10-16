-- Uses existing identities, transaction-local claims and rollback only. Never grants lasting access.
begin;
do $$
declare admin_id uuid; owner_id uuid; sid uuid; tid uuid:=gen_random_uuid(); template jsonb; n integer; checks integer:=0;
begin
 select user_id into admin_id from public.admin_users where active order by user_id limit 1;
 select s.id,s.owner_user_id into sid,owner_id from public.stores s
 where s.owner_user_id is not null and not exists(select 1 from public.admin_users a where a.user_id=s.owner_user_id and a.active)
 and not exists(select 1 from public.member_status m where m.user_id=s.owner_user_id and m.suspended) limit 1;
 select structure into template from public.poker_tournaments limit 1;
 if admin_id is null or owner_id is null or template is null then raise exception 'Missing test fixtures'; end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);execute 'set local role authenticated';
 begin
 insert into public.poker_tournament_store_access(store_id,enabled) values(sid,true);
 raise exception 'Self grant was allowed';exception when insufficient_privilege then checks:=checks+1;end;
 begin
 insert into public.poker_tournaments(id,owner_store_id,title,starts_at,structure) values(tid,sid,'__permission_rollback__',now(),template);
 raise exception 'Unpermitted insert was allowed';exception when insufficient_privilege then checks:=checks+1;end;
 execute 'reset role';perform set_config('request.jwt.claim.sub',admin_id::text,true);execute 'set local role authenticated';
 insert into public.poker_tournament_store_access(store_id,enabled) values(sid,true);checks:=checks+1;
 execute 'reset role';perform set_config('request.jwt.claim.sub',owner_id::text,true);execute 'set local role authenticated';
 insert into public.poker_tournaments(id,owner_store_id,title,starts_at,structure) values(tid,sid,'__permission_rollback__',now(),template);checks:=checks+1;
 update public.poker_tournaments set title='__permission_rollback_updated__' where id=tid;get diagnostics n=row_count;
 if n<>1 then raise exception 'Approved update failed';end if;checks:=checks+1;
 insert into storage.objects(bucket_id,name) values('poker-tournament-images',owner_id::text||'/'||sid::text||'/'||tid::text||'.png');checks:=checks+1;
 execute 'reset role';perform set_config('request.jwt.claim.sub',admin_id::text,true);execute 'set local role authenticated';
 update public.poker_tournament_store_access set enabled=false where store_id=sid;get diagnostics n=row_count;
 if n<>1 then raise exception 'Admin revoke failed';end if;checks:=checks+1;
 execute 'reset role';perform set_config('request.jwt.claim.sub',owner_id::text,true);execute 'set local role authenticated';
 update public.poker_tournaments set title='__permission_rollback_blocked__' where id=tid;get diagnostics n=row_count;
 if n<>0 then raise exception 'Revoked update allowed';end if;checks:=checks+1;
 update public.poker_tournament_store_access set enabled=true where store_id=sid;get diagnostics n=row_count;
 if n<>0 then raise exception 'Owner re-enabled access';end if;checks:=checks+1;
 begin
 insert into storage.objects(bucket_id,name) values('poker-tournament-images',owner_id::text||'/'||sid::text||'/'||tid::text||'-blocked.png');
 raise exception 'Revoked upload allowed';exception when insufficient_privilege then checks:=checks+1;end;
 execute 'reset role';perform set_config('request.jwt.claim.sub',admin_id::text,true);execute 'set local role authenticated';
 update public.poker_tournaments set title='__permission_rollback_admin__' where id=tid;get diagnostics n=row_count;
 if n<>1 then raise exception 'Admin cannot manage revoked store';end if;checks:=checks+1;
 execute 'reset role';
 raise notice 'PASS: % live permission assertions, rollback follows',checks;
end $$;
rollback;
select json_build_object('permission_rows',(select count(*) from public.poker_tournament_store_access),'tournament_test_rows',(select count(*) from public.poker_tournaments where title like '__permission_rollback%'),'storage_test_rows',(select count(*) from storage.objects where bucket_id='poker-tournament-images' and name like '%-blocked.png'));
