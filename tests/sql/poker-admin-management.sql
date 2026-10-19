-- Staging-only verification; every insert/update is rolled back.
begin;
create function pg_temp.expect_failure(statement text,fragment text) returns void language plpgsql as $$
begin
 begin execute statement; exception when others then if position(fragment in sqlerrm)>0 then return; else raise; end if; end;
 raise exception 'Expected rejection: %',fragment;
end;$$;
do $$
declare admin_id uuid; member_id uuid; saved jsonb; settings jsonb:='{"title":"QA ring rollback","capacity":6,"sb":50,"bb":100,"min_buy_in":2000,"max_buy_in":10000,"note":"QA","published":true,"sort_order":0}'; rid uuid; tid uuid; archived uuid; archived_title text; active uuid; active_title text; finish_count bigint; hand_count bigint; template jsonb;
begin
 select user_id into admin_id from public.admin_users order by user_id limit 1;
 select id into member_id from auth.users where id not in(select user_id from public.admin_users) order by id limit 1;
 if admin_id is null or member_id is null then raise exception 'Requires staging admin and ordinary test member'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 saved:=public.poker_admin_ring_save(null,0,settings);rid:=(saved->>'id')::uuid;
 if saved->>'revision'<>'1' then raise exception 'Create revision failed'; end if;
 perform set_config('poker.qa_ring',rid::text,true);
 perform pg_temp.expect_failure(format('select public.poker_admin_ring_save(%L,0,%L::jsonb)',rid,settings),'Settings changed');
 saved:=public.poker_admin_ring_save(rid,1,settings||'{"capacity":2}'::jsonb);
 if saved->>'capacity'<>'2' or saved->>'revision'<>'2' then raise exception 'Update failed'; end if;
 perform pg_temp.expect_failure(format('select public.poker_admin_ring_save(null,0,%L::jsonb)',settings||'{"capacity":3}'::jsonb),'check constraint');
 perform set_config('request.jwt.claim.sub',member_id::text,true);
 perform pg_temp.expect_failure(format('select public.poker_admin_ring_save(null,0,%L::jsonb)',settings),'Admin required');
 perform pg_temp.expect_failure(format('select public.poker_admin_ring_remove(%L,2,%L)',rid,'QA ring rollback'),'Admin required');
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 select structure into template from public.poker_tournaments limit 1;
 insert into public.poker_tournaments(title,starts_at,structure) values('QA tournament rollback',now()+interval '1 day',template) returning id into tid;
 perform set_config('request.jwt.claim.sub',member_id::text,true);
 perform pg_temp.expect_failure(format('select public.poker_admin_tournament_remove(%L,%L)',tid,'QA tournament rollback'),'Admin required');
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform pg_temp.expect_failure(format('select public.poker_admin_tournament_remove(%L,%L)',tid,'wrong title'),'Settings changed');
 perform public.poker_admin_tournament_remove(tid,'QA tournament rollback');
 if not exists(select 1 from public.poker_tournaments where id=tid and deleted_at is not null and not published) then raise exception 'Tournament removal failed'; end if;
 perform pg_temp.expect_failure(format('update public.poker_tournaments set published=true where id=%L',tid),'Tournament removed');
 select t.id,t.title into active,active_title from public.poker_tournaments t join poker_private.tournament_rooms r on r.tournament_id=t.id left join poker_private.tournament_finishes f on f.tournament_id=t.id where t.deleted_at is null and (f.finished_at is null or clock_timestamp()<f.finished_at+interval '10 minutes') limit 1;
 if active is not null then perform pg_temp.expect_failure(format('select public.poker_admin_tournament_remove(%L,%L)',active,active_title),'Tournament active');end if;
 select t.id,t.title into archived,archived_title from public.poker_tournaments t join poker_private.tournament_finishes f on f.tournament_id=t.id where t.deleted_at is null and f.finished_at<now()-interval '10 minutes' limit 1;
 if archived is null then raise exception 'Requires a completed staging tournament'; end if;
 select count(*) into finish_count from poker_private.tournament_finishes;select count(*) into hand_count from poker_private.hand_results;
 perform public.poker_admin_tournament_remove(archived,archived_title);
 if (select count(*) from poker_private.tournament_finishes)<>finish_count or (select count(*) from poker_private.hand_results)<>hand_count then raise exception 'Archive changed';end if;
 if not exists(select 1 from poker_private.tournament_finishes where tournament_id=archived) then raise exception 'History lost';end if;
 -- Statistics must remain callable and retain the history joins.
 perform public.poker_statistics(true);
 if (select prosecdef from pg_proc where oid='public.poker_statistics(boolean)'::regprocedure) then raise exception 'Statistics API must remain security invoker';end if;
 if not (select prosecdef from pg_proc where oid='poker_private.poker_statistics(boolean)'::regprocedure) then raise exception 'Private statistics reader missing';end if;
end;$$;
set local role anon;
do $$begin
 if (select count(*) from public.poker_ring_tables where id=current_setting('poker.qa_ring')::uuid)<>1 then raise exception 'Published ring RLS failed';end if;
 if has_function_privilege(current_user,'public.poker_admin_ring_save(uuid,bigint,jsonb)','EXECUTE') then raise exception 'Anonymous mutation granted';end if;
end;$$;
reset role;
do $$declare rid uuid:=current_setting('poker.qa_ring')::uuid;begin
 perform public.poker_admin_ring_remove(rid,2,'QA ring rollback');
 if not exists(select 1 from public.poker_ring_tables where id=rid and deleted_at is not null and not published) then raise exception 'Ring removal failed';end if;
end;$$;
set local role authenticated;
do $$begin
 if has_column_privilege(current_user,'public.poker_tournaments','deleted_at','UPDATE') then raise exception 'Deletion guard bypass granted';end if;
end;$$;
set local role anon;
do $$begin
 if exists(select 1 from public.poker_ring_tables where id=current_setting('poker.qa_ring')::uuid) then raise exception 'Deleted ring visible';end if;
end;$$;
reset role;
rollback;
select 'PASS: admin-only CRUD, stale revision, invalid settings, removal, RLS, active-game guard and retained archives (rolled back)' as verification;
