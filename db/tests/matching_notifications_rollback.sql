begin;
do $qa$
declare r public.dealer_matching_records;owner uuid;outsider uuid;app uuid;offer uuid;msg uuid;cnt int;
begin
 select * into r from public.dealer_matching_records order by created_at limit 1;if r.id is null then raise exception 'QA requires a matching record';end if;
 select owner_user_id into owner from public.stores where id=r.store_id;
 select id into outsider from auth.users where id not in(owner,r.dealer_user_id) limit 1;
 insert into public.user_legal_consents(user_id,scope,terms_version,privacy_version,rules_version,source) values(owner,'matching_store','2026-10-07','2026-10-07','2026-10-07','matching_consent'),(r.dealer_user_id,'matching_dealer','2026-10-07','2026-10-07','2026-10-07','matching_consent') on conflict do nothing;
 insert into public.dealer_matching_records(store_id,dealer_user_id,work_start,work_end,job_snapshot) values(r.store_id,r.dealer_user_id,now()+interval '10 days',now()+interval '10 days 4 hours',r.job_snapshot-'source') returning id into app;
 insert into public.dealer_matching_records(store_id,dealer_user_id,work_start,work_end,job_snapshot) values(r.store_id,r.dealer_user_id,now()+interval '11 days',now()+interval '11 days 4 hours',r.job_snapshot||'{"source":"store_offer"}') returning id into offer;
 if (select count(*) from public.matching_notifications where record_id in(app,offer))<>2 then raise exception 'Application/offer notices missing';end if;
 if not exists(select 1 from public.matching_notifications where record_id=app and recipient_id=owner and recipient_actor='store' and kind='application')then raise exception 'Wrong application recipient';end if;
 if not exists(select 1 from public.matching_notifications where record_id=offer and recipient_id=r.dealer_user_id and recipient_actor='dealer' and kind='offer')then raise exception 'Wrong offer recipient';end if;
 if (select count(*) from private.matching_notification_delivery d join public.matching_notifications n on n.id=d.notification_id where n.record_id in(app,offer))<>3 then raise exception 'Wrong delivery channels';end if;
 perform set_config('request.jwt.claim.sub',r.dealer_user_id::text,true);
 perform public.dealer_chat_operation(app,'consent','{}');
 msg:=public.dealer_chat_operation(app,'send',jsonb_build_object('body','勤務を確認します','nonce','11111111-1111-4111-8111-111111111111'));
 perform public.dealer_chat_operation(app,'send',jsonb_build_object('body','勤務を確認します','nonce','11111111-1111-4111-8111-111111111111'));
 if (select count(*) from public.matching_notifications where record_id=app and kind='message')<>1 then raise exception 'Duplicate send duplicated notice';end if;
 perform set_config('request.jwt.claim.sub',owner::text,true);
 perform public.dealer_chat_operation(app,'consent','{}');
 perform public.mark_matching_notifications(app,array[msg]);
 if exists(select 1 from public.matching_notifications where event_id=msg and read_at is null) then raise exception 'Read receipt missing';end if;
 if not exists(select 1 from public.matching_notifications where event_id=app and read_at is null) then raise exception 'Unseen notice marked read';end if;
 if has_function_privilege('authenticated','public.claim_matching_notifications(uuid)','EXECUTE') or has_function_privilege('anon','public.claim_matching_notifications(uuid)','EXECUTE') then raise exception 'Delivery target exposed';end if;
 if has_table_privilege('authenticated','private.matching_notification_delivery','SELECT') then raise exception 'Outbox exposed';end if;
 perform set_config('qa.app',app::text,true);perform set_config('qa.owner',owner::text,true);perform set_config('qa.dealer',r.dealer_user_id::text,true);perform set_config('qa.outsider',outsider::text,true);
end $qa$;
set local role authenticated;
do $qa$ begin
 perform set_config('request.jwt.claim.sub',current_setting('qa.owner'),true);
 if (select count(*) from public.matching_notifications where record_id=current_setting('qa.app')::uuid)<>2 then raise exception 'Own inbox missing';end if;
 if (select count(*) from public.matching_unread_rooms('store',1) where record_id=current_setting('qa.app')::uuid)<>1 then raise exception 'Unread room missing';end if;
 perform set_config('request.jwt.claim.sub',current_setting('qa.outsider'),true);
 if exists(select 1 from public.matching_notifications where record_id=current_setting('qa.app')::uuid)then raise exception 'Outsider inbox leak';end if;
end $qa$;
reset role;
do $qa$ declare c record;cnt int:=0;begin
 perform set_config('request.jwt.claim.role','service_role',true);
 for c in select * from public.claim_matching_notifications(current_setting('qa.app')::uuid)loop
  cnt:=cnt+1;
  perform public.finish_matching_notification(c.notification_id,c.channel,c.lock_token,'sent',null);
 end loop;
 if cnt<>4 then raise exception 'Claim expected 4 delivery jobs got %',cnt;end if;
 if exists(select 1 from public.claim_matching_notifications(current_setting('qa.app')::uuid))then raise exception 'Sent jobs reclaimed';end if;
end $qa$;
rollback;
select 'PASS: application/offer/message recipients, channel routing, deduplication, selective read, recipient RLS and service-only delivery claims; all changes rolled back' as verification;
