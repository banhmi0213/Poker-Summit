-- STAGING ONLY. Exercises real Postgres RLS and triggers as authenticated users.
-- No account passwords are read or changed. All fixtures roll back.
begin;
select set_config('board_test.owner',(select id::text from auth.users order by id limit 1),true);
select set_config('board_test.other',(select id::text from auth.users order by id offset 1 limit 1),true);
insert into public.profiles(user_id,display_name) values(current_setting('board_test.owner')::uuid,'検証A'),(current_setting('board_test.other')::uuid,'検証B') on conflict(user_id) do nothing;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('board_test.owner'),'role','authenticated')::text,true);
insert into public.board_posts(id,author_user_id,author_name,title,body) values('a1000000-0000-4000-8000-000000000001',auth.uid(),'A','phase1 test','body'),('a1000000-0000-4000-8000-000000000002',auth.uid(),'A','other test','body');
insert into public.board_replies(id,post_id,author_user_id,author_name,body) values('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',auth.uid(),'A','root');
select set_config('request.jwt.claims',json_build_object('sub',current_setting('board_test.other'),'role','authenticated')::text,true);
insert into public.board_thread_preferences(post_id,user_id,following) values('a1000000-0000-4000-8000-000000000001',auth.uid(),true);
do $$ begin
 begin insert into public.board_resolutions(post_id) values('a1000000-0000-4000-8000-000000000001'); raise exception 'non-owner resolved thread'; exception when insufficient_privilege then null; end;
 begin insert into public.board_thread_preferences(post_id,user_id,following) values('a1000000-0000-4000-8000-000000000002',current_setting('board_test.owner')::uuid,true); raise exception 'other-user preference accepted'; exception when insufficient_privilege then null; end;
 begin insert into public.board_replies(post_id,parent_reply_id,author_user_id,author_name,body) values('a1000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001',auth.uid(),'B','invalid'); raise exception 'cross-thread accepted'; exception when raise_exception then if SQLERRM='cross-thread accepted' then raise; end if; end;
end $$;
insert into public.board_replies(id,post_id,parent_reply_id,author_user_id,author_name,body) values('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001',auth.uid(),'B','child');
insert into public.board_reactions(post_id,reply_id,user_id,emoji) values('a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001',auth.uid(),'helpful');
do $$ begin
 begin insert into public.board_reactions(post_id,reply_id,user_id,emoji) values('a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001',auth.uid(),'helpful'); raise exception 'duplicate reaction accepted'; exception when unique_violation then null; end;
 begin insert into public.board_reactions(post_id,reply_id,user_id,emoji) values('a1000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001',auth.uid(),'nice'); raise exception 'cross-thread reaction accepted'; exception when insufficient_privilege then null; end;
 if (select total from public.board_reaction_summary('a1000000-0000-4000-8000-000000000001',array['a2000000-0000-4000-8000-000000000001'::uuid]) where emoji='helpful') is distinct from 1 then raise exception 'wrong reaction count'; end if;
 if exists(select 1 from public.board_notifications where post_id='a1000000-0000-4000-8000-000000000001') then raise exception 'self notifications visible'; end if;
 begin insert into public.board_replies(post_id,parent_reply_id,author_user_id,author_name,body) values('a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002',auth.uid(),'B','deep invalid'); raise exception 'deep parent accepted'; exception when raise_exception then if SQLERRM='deep parent accepted' then raise; end if; end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('board_test.owner'),'role','authenticated')::text,true);
do $$ begin
 if (select count(*) from public.board_notifications where post_id='a1000000-0000-4000-8000-000000000001' and kind='reply')is distinct from 1 then raise exception 'reply notification missing'; end if;
 if exists(select 1 from public.board_thread_preferences where post_id='a1000000-0000-4000-8000-000000000001') then raise exception 'another user preferences leaked'; end if;
end $$;
insert into public.board_resolutions(post_id,reply_id) values('a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002');
delete from public.board_resolutions where post_id='a1000000-0000-4000-8000-000000000001';
insert into public.board_replies(id,post_id,author_user_id,author_name,body) values('a2000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001',auth.uid(),'A','Hello @[spoof]('||current_setting('board_test.other')||')');
select set_config('request.jwt.claims',json_build_object('sub',current_setting('board_test.other'),'role','authenticated')::text,true);
do $$ begin
 if (select count(*) from public.board_notifications where post_id='a1000000-0000-4000-8000-000000000001' and kind='mention')is distinct from 1 then raise exception 'mention/follow notification dedup failed'; end if;
 if exists(select 1 from public.board_replies where id='a2000000-0000-4000-8000-000000000003' and body like '%spoof%') then raise exception 'spoofed mention name retained'; end if;
end $$;
update public.board_notifications set read_at=now() where post_id='a1000000-0000-4000-8000-000000000001';
update public.board_thread_preferences set notifications_enabled=false where post_id='a1000000-0000-4000-8000-000000000001' and user_id=auth.uid();
select set_config('request.jwt.claims',json_build_object('sub',current_setting('board_test.owner'),'role','authenticated')::text,true);
insert into public.board_replies(id,post_id,author_user_id,author_name,body) values('a2000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000001',auth.uid(),'A','muted @[B]('||current_setting('board_test.other')||')');
select set_config('request.jwt.claims',json_build_object('sub',current_setting('board_test.other'),'role','authenticated')::text,true);
do $$ begin
 if exists(select 1 from public.board_notifications where reply_id='a2000000-0000-4000-8000-000000000004') then raise exception 'muted mention delivered'; end if;
 if exists(select 1 from public.board_notifications where post_id='a1000000-0000-4000-8000-000000000001' and read_at is null) then raise exception 'mark-read failed'; end if;
 if (select total from public.board_reply_counts('a1000000-0000-4000-8000-000000000001') where parent_reply_id='a2000000-0000-4000-8000-000000000001')is distinct from 1 then raise exception 'child count wrong'; end if;
end $$;
-- A moderated answer must not strand the owner's resolution control.
select set_config('request.jwt.claims',json_build_object('sub',current_setting('board_test.owner'),'role','authenticated')::text,true);
insert into public.board_resolutions(post_id,reply_id) values('a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002');
reset role;
update public.board_replies set status='hidden' where id='a2000000-0000-4000-8000-000000000002';
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.board_resolutions where post_id='a1000000-0000-4000-8000-000000000001') then raise exception 'hidden answer stranded resolution'; end if;
end $$;
delete from public.board_resolutions where post_id='a1000000-0000-4000-8000-000000000001';
set local role anon;
do $$ begin
 begin perform * from public.board_notifications; raise exception 'anonymous notifications readable'; exception when insufficient_privilege then null; end;
 begin perform * from public.board_thread_preferences; raise exception 'anonymous follows readable'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: ownership, preference privacy, nesting, cross-thread rejection, reaction uniqueness/counts, replies, mentions, deduplication, mute, read, anonymous isolation; fixtures rolled back' as result;
