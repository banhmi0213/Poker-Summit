begin;
do $test$
declare r public.dealer_matching_records; owner uuid; stranger uuid; sent uuid; duplicate uuid; fail boolean; revision integer; report uuid;
begin
 select * into r from public.dealer_matching_records where status='pending' and work_start>now() order by work_start limit 1;
 if r.id is null then raise exception 'QA requires future pending work'; end if;
 select owner_user_id into owner from public.stores where id=r.store_id;
 select id into stranger from auth.users where id not in (owner,r.dealer_user_id) and not exists(select 1 from public.admin_users a where a.user_id=auth.users.id) limit 1;
 if stranger is null then raise exception 'QA requires unrelated account'; end if;
 perform set_config('qa.record',r.id::text,true);perform set_config('qa.owner',owner::text,true);perform set_config('qa.dealer',r.dealer_user_id::text,true);perform set_config('qa.stranger',stranger::text,true);
 insert into public.user_legal_consents(user_id,scope,terms_version,privacy_version,rules_version,source) values(owner,'matching_store','2026-10-07','2026-10-07','2026-10-07','matching_consent'),(r.dealer_user_id,'matching_dealer','2026-10-07','2026-10-07','2026-10-07','matching_consent') on conflict do nothing;
 insert into public.dealer_private_contacts(user_id,phone,contact_type,contact_value,disclosure_consented_at,disclosure_version)
 values(r.dealer_user_id,'090-0000-0000','email','qa@example.invalid',now(),'2026-10-07-contact-v1')
 on conflict(user_id) do update set phone=excluded.phone,contact_type=excluded.contact_type,contact_value=excluded.contact_value,disclosure_consented_at=excluded.disclosure_consented_at,disclosure_version=excluded.disclosure_version;
 perform set_config('request.jwt.claim.sub',owner::text,true);
 if exists(select 1 from public.get_matching_dealer_contacts(r.id))then raise exception 'Contacts before agreement leaked';end if;
 fail:=false;begin perform public.dealer_chat_operation(r.id,'send',jsonb_build_object('body','勤務条件を確認します','nonce',gen_random_uuid()));exception when sqlstate 'P0001' then fail:=true;end;
 if not fail then raise exception 'Missing chat consent accepted';end if;
 perform public.dealer_chat_operation(r.id,'consent','{}');
 perform public.dealer_chat_operation(r.id,'terms','{"revision":0,"contract_type":"employment","payment_method":"bank","payment_date":"翌月15日","notes":"交通費は求人条件に従う"}');
 fail:=false;begin perform public.update_spot_work(r.id,'store','confirm',null);exception when sqlstate 'P0001' then fail:=true;end;
 if not fail then raise exception 'Legacy confirm bypass';end if;
 perform public.dealer_chat_operation(r.id,'confirm','{"revision":1}');
 perform public.dealer_chat_operation(r.id,'terms','{"revision":1,"contract_type":"employment","payment_method":"bank","payment_date":"翌月20日","notes":"条件変更"}');
 if exists(select 1 from public.dealer_matching_records where id=r.id and(store_confirmed_at is not null or dealer_confirmed_at is not null))then raise exception 'Changed terms did not revoke confirmations';end if;
 fail:=false;begin perform public.dealer_chat_operation(r.id,'confirm','{"revision":1}');exception when sqlstate 'P0001' then fail:=true;end;if not fail then raise exception 'Stale conditions accepted';end if;
 perform public.dealer_chat_operation(r.id,'confirm','{"revision":2}');
 perform set_config('request.jwt.claim.sub',r.dealer_user_id::text,true);
 perform public.dealer_chat_operation(r.id,'consent','{}');
 fail:=false;begin perform public.dealer_chat_operation(r.id,'send',jsonb_build_object('body','LINE IDはこちら @dealer','nonce',gen_random_uuid()));exception when sqlstate 'P0001' then fail:=true;end;if not fail then raise exception 'Preagreement contact allowed';end if;
 sent:=public.dealer_chat_operation(r.id,'send',jsonb_build_object('body','条件を確認しました','nonce','11111111-1111-4111-8111-111111111111'));
 duplicate:=public.dealer_chat_operation(r.id,'send',jsonb_build_object('body','条件を確認しました','nonce','11111111-1111-4111-8111-111111111111'));
 if sent<>duplicate then raise exception 'Duplicate send created second message';end if;
 perform public.dealer_chat_operation(r.id,'confirm','{"revision":2}');
 if not exists(select 1 from public.dealer_matching_records where id=r.id and status='confirmed' and dealer_confirmed_at is not null and store_confirmed_at is not null)then raise exception 'Both confirmations not recorded';end if;
 perform set_config('request.jwt.claim.sub',owner::text,true);
 if (select count(*) from public.get_matching_dealer_contacts(r.id))<>1 then raise exception 'Agreed store cannot obtain consented contacts';end if;
 update public.dealer_profiles set published=true where user_id=r.dealer_user_id;
 if public.offer_spot_work(r.dealer_user_id,r.spot_job_id,(r.work_start at time zone 'Asia/Tokyo')::date)<>r.id then raise exception 'Offer duplicated existing application';end if;
 perform set_config('request.jwt.claim.sub',r.dealer_user_id::text,true);
 perform public.dealer_chat_operation(r.id,'block','{}');
 fail:=false;begin perform public.dealer_chat_operation(r.id,'send',jsonb_build_object('body','確認','nonce',gen_random_uuid()));exception when sqlstate 'P0001' then fail:=true;end;if not fail then raise exception 'Blocked send allowed';end if;
 report:=public.dealer_chat_operation(r.id,'report','{"reason":"検証用の通報（ロールバック）"}');
 perform set_config('request.jwt.claim.sub',owner::text,true);perform public.dealer_chat_operation(r.id,'unblock','{}');
 if not exists(select 1 from public.dealer_chat_blocks where record_id=r.id and user_id=r.dealer_user_id)then raise exception 'Removed someone else block';end if;
 perform set_config('request.jwt.claim.sub',stranger::text,true);
 fail:=false;begin perform public.dealer_chat_operation(r.id,'consent','{}');exception when sqlstate 'P0001' then fail:=true;end;if not fail then raise exception 'Unrelated consent allowed';end if;
 if exists(select 1 from public.get_matching_dealer_contacts(r.id))then raise exception 'Unrelated contacts leaked';end if;
 if has_function_privilege('anon','public.dealer_chat_operation(uuid,text,jsonb)','EXECUTE')then raise exception 'Anonymous RPC allowed';end if;
 if has_table_privilege('authenticated','public.dealer_chat_messages','INSERT')then raise exception 'Direct message insertion allowed';end if;
end $test$;
set local role authenticated;
do $test$
declare fail boolean;
begin
 if exists(select 1 from public.dealer_chat_messages where record_id=current_setting('qa.record')::uuid)then raise exception 'Unrelated messages leaked by RLS';end if;
 if exists(select 1 from public.dealer_chat_terms where record_id=current_setting('qa.record')::uuid)then raise exception 'Unrelated terms leaked';end if;
 perform set_config('request.jwt.claim.sub',current_setting('qa.owner'),true);
 if (select count(*) from public.dealer_chat_messages where record_id=current_setting('qa.record')::uuid)<>1 then raise exception 'Participant cannot read messages';end if;
 fail:=false;begin insert into public.dealer_chat_messages(record_id,sender_id,body,nonce)values(current_setting('qa.record')::uuid,current_setting('qa.owner')::uuid,'bypass',gen_random_uuid());exception when insufficient_privilege then fail:=true;end;if not fail then raise exception 'Direct write bypass';end if;
end $test$;
rollback;
select 'PASS: consent, reset, stale revision, dual agreement, idempotency, block, report, participant RLS, private contacts, anonymous/write denial; all test changes rolled back' as verification;
