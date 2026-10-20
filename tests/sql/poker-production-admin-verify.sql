-- Transaction-only smoke test: no rows or user changes survive.
begin;
do $$
declare actor uuid; ordinary uuid; r jsonb; tid uuid; rid uuid; template jsonb;
begin
 select user_id into actor from public.admin_users order by user_id limit 1;
 if actor is null then raise exception 'Admin fixture missing';end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 r:=public.poker_admin_ring_save(null,0,'{"title":"QA temporary ring","capacity":6,"sb":50,"bb":100,"min_buy_in":2000,"max_buy_in":10000,"note":"","published":true,"sort_order":0}');rid:=(r->>'id')::uuid;
 if r->>'revision'<>'1' then raise exception 'Create failed';end if;
 r:=public.poker_admin_ring_save(rid,1,'{"title":"QA temporary ring","capacity":2,"sb":50,"bb":100,"min_buy_in":2000,"max_buy_in":10000,"note":"","published":true,"sort_order":0}');
 if r->>'revision'<>'2' or r->>'capacity'<>'2' then raise exception 'Update failed';end if;
 select id into ordinary from auth.users where id not in(select user_id from public.admin_users) limit 1;
 if ordinary is null then raise exception 'Ordinary member fixture missing';end if;
 perform set_config('request.jwt.claim.sub',ordinary::text,true);
 begin perform public.poker_admin_ring_remove(rid,2,'QA temporary ring');raise exception 'Unauthorized mutation accepted';exception when others then if sqlerrm<>'Admin required' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform public.poker_admin_ring_remove(rid,2,'QA temporary ring');
 if not exists(select 1 from public.poker_ring_tables where id=rid and deleted_at is not null and not published) then raise exception 'Removal failed';end if;
 select structure into template from public.poker_tournaments limit 1;
 if template is null then template:='{"startingStack":10000,"anteType":"none","lateRegLevel":1,"reentry":false,"periods":[{"kind":"level","minutes":20,"sb":50,"bb":100,"ante":0,"note":""}]}';end if;
 insert into public.poker_tournaments(title,starts_at,structure) values('QA temporary tournament',now()+interval '1 day',template) returning id into tid;
 perform public.poker_admin_tournament_remove(tid,'QA temporary tournament');
 if not exists(select 1 from public.poker_tournaments where id=tid and deleted_at is not null and not published) then raise exception 'Tournament removal failed';end if;
 perform set_config('poker.qa_ring',rid::text,true);
end;$$;
set local role anon;
do $$begin
 if exists(select 1 from public.poker_ring_tables where id=current_setting('poker.qa_ring')::uuid) then raise exception 'Removed row exposed';end if;
 if has_function_privilege(current_user,'public.poker_admin_ring_save(uuid,bigint,jsonb)','EXECUTE') then raise exception 'Anonymous writer exposed';end if;
end;$$;
reset role;
set local role authenticated;
do $$begin if has_column_privilege(current_user,'public.poker_tournaments','deleted_at','UPDATE') then raise exception 'Removal guard bypass granted';end if;end;$$;
reset role;
rollback;
select 'PASS: production configuration CRUD, admin guard, tournament removal, RLS; all changes rolled back' as verification;
