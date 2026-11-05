begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
-- Staging is poker-only. Missing portal tables are transactional test doubles, rolled back.
do $fixtures$
declare r record;
begin
 for r in select * from (values
 ('dealer_matching_records','dealer_user_id uuid, verified_by uuid'),
 ('dealer_chat_consents','user_id uuid'),
 ('dealer_chat_messages','sender_id uuid'),
 ('dealer_chat_blocks','user_id uuid'),
 ('dealer_chat_reports','reporter_id uuid, resolved_by uuid'),
 ('matching_notifications','recipient_id uuid, sender_id uuid'),
 ('dealer_chat_terms','updated_by uuid'),
 ('store_change_requests','reviewed_by uuid'),
 ('dealer_addresses','user_id uuid'),
 ('dealer_private_contacts','user_id uuid'),
 ('favorite_stores','user_id uuid'),
 ('favorite_jobs','user_id uuid'),
 ('favorite_coupons','user_id uuid'),
 ('favorite_events','user_id uuid'),
 ('event_participants','user_id uuid'),
 ('academy_graduation','user_id uuid'),
 ('admin_seen','user_id uuid'),
 ('dealer_profiles','user_id uuid, full_name text, appeal text, photo_url text, published boolean, updated_at timestamptz')
 ) as t(name,columns)
 loop
  if to_regclass('public.'||r.name) is null then
   execute format('create table public.%I (%s)',r.name,r.columns);
  end if;
 end loop;
end
$fixtures$;
do $test$
declare
 deleted_uid uuid := gen_random_uuid();
 retained_uid uuid := gen_random_uuid();
 other_uid uuid := gen_random_uuid();
 visitor uuid := gen_random_uuid();
 event_deleted uuid := gen_random_uuid();
 event_retained uuid := gen_random_uuid();
 event_other uuid := gen_random_uuid();
 event_anon uuid := gen_random_uuid();
 baseline jsonb;
 after_rows jsonb;
begin
 insert into auth.users(id,email,raw_user_meta_data) values
 (deleted_uid,'withdraw-test+'||deleted_uid||'@example.invalid','{}'),
 (retained_uid,'withdraw-test+'||retained_uid||'@example.invalid','{}'),
 (other_uid,'withdraw-test+'||other_uid||'@example.invalid','{}');
 insert into public.gto_usage_events(id,visitor_id,member_id,tool,action,device) values
 (event_deleted,visitor,deleted_uid,'flop','open','pc'),
 (event_retained,visitor,retained_uid,'drill','answer','mobile'),
 (event_other,visitor,other_uid,'preflop','start','pc'),
 (event_anon,visitor,null,'flop','open','mobile');
 select jsonb_agg(to_jsonb(e)-'member_id' order by id) into baseline
 from public.gto_usage_events e where id in (event_deleted,event_retained,event_other,event_anon);
 insert into public.dealer_chat_consents(user_id) values(retained_uid);
 insert into public.dealer_profiles(user_id,full_name,appeal,photo_url,published)
 values(retained_uid,'test dealer','test appeal','https://example.invalid/test',true);
 insert into public.profiles(user_id,display_name) values(retained_uid,'withdraw test');
 insert into auth.identities(provider_id,user_id,identity_data,provider) values(retained_uid::text,retained_uid,'{}','email');
 insert into auth.sessions(id,user_id) values(gen_random_uuid(),retained_uid);
 insert into public.poker_gto_practice_hands(member_id,seats,net,hand) values
 (deleted_uid,6,0,'{}'),(retained_uid,6,0,'{}'),(other_uid,6,0,'{}');
 insert into public.poker_gto_decisions(member_id,source,seats,stack,position,street,spot,hand,action)
 values(deleted_uid,'trainer',6,100,'BTN','preflop','btn-bb','AA','raise'),
 (retained_uid,'trainer',6,100,'BTN','preflop','btn-bb','AA','raise'),
 (other_uid,'trainer',6,100,'BTN','preflop','btn-bb','AA','raise');
 insert into poker_private.member_notes(owner_id,target_id,note) values
 (retained_uid,other_uid,'written'),(other_uid,retained_uid,'received');

 perform private.withdraw_member(deleted_uid);
 perform private.withdraw_member(retained_uid);

 assert not exists(select 1 from auth.users where id=deleted_uid),'hard deletion changed';
 assert exists(select 1 from auth.users where id=retained_uid and email='withdrawn+'||retained_uid||'@withdrawn.invalid' and banned_until='infinity'::timestamptz and encrypted_password=''),'retained user not anonymized';
 assert not exists(select 1 from auth.identities where user_id=retained_uid),'identity retained';
 assert not exists(select 1 from auth.sessions where user_id=retained_uid),'session retained';
 assert not exists(select 1 from public.profiles where user_id=retained_uid),'profile retained';
 assert exists(select 1 from public.dealer_profiles where user_id=retained_uid and full_name='退会済みのディーラー' and appeal='' and photo_url is null and not published),'dealer profile changed';
 assert exists(select 1 from public.dealer_chat_consents where user_id=retained_uid),'retained records lost';
 assert not exists(select 1 from public.poker_gto_decisions where member_id in(deleted_uid,retained_uid)),'GTO decisions retained';
 assert not exists(select 1 from public.poker_gto_practice_hands where member_id in(deleted_uid,retained_uid)),'practice hands retained';
 assert not exists(select 1 from poker_private.member_notes where owner_id=retained_uid or target_id=retained_uid),'notes retained';
 assert exists(select 1 from public.poker_gto_decisions where member_id=other_uid),'other member decisions changed';
 assert exists(select 1 from public.poker_gto_practice_hands where member_id=other_uid),'other member practice changed';
 assert (select count(*) from public.gto_usage_events where id in(event_deleted,event_retained) and member_id is null)=2,'withdrawn member_id retained';
 assert exists(select 1 from public.gto_usage_events where id=event_other and member_id=other_uid),'other member usage changed';
 assert exists(select 1 from public.gto_usage_events where id=event_anon and member_id is null),'anonymous usage changed';
 select jsonb_agg(to_jsonb(e)-'member_id' order by id) into after_rows
 from public.gto_usage_events e where id in(event_deleted,event_retained,event_other,event_anon);
 assert baseline=after_rows,'usage events/counts/payload changed';
 assert not has_function_privilege('anon','private.withdraw_member(uuid)','execute'),'anon function access';
 assert not has_function_privilege('authenticated','private.withdraw_member(uuid)','execute'),'member function access';
 assert not has_table_privilege('anon','public.gto_usage_events','select'),'anon usage access';
 assert not has_table_privilege('authenticated','public.gto_usage_events','select'),'member usage access';
end
$test$;

rollback;
select 'passed: hard deletion, retained-record anonymization, GTO cleanup, other members, aggregate preservation, ACL; all test data rolled back' as result;