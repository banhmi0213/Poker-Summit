begin;
-- All fixtures and consent/profile changes are rolled back, no notification delivery.
do $setup$
declare r public.dealer_matching_records; owner uuid; stranger uuid; fixture uuid;
begin
 select m.* into r from public.dealer_matching_records m join public.stores s on s.id=m.store_id where s.owner_user_id is not null and s.owner_user_id<>m.dealer_user_id order by m.created_at limit 1;
 if r.id is null then raise exception 'QA requires one matching record with distinct participants';end if;
 select owner_user_id into owner from public.stores where id=r.store_id;
 select u.id into stranger from auth.users u where u.id not in(owner,r.dealer_user_id) and not exists(select 1 from public.stores s where s.owner_user_id=u.id) and not exists(select 1 from public.member_status s where s.user_id=u.id and s.suspended) limit 1;
 if stranger is null then raise exception 'QA requires a non-store outsider';end if;
 insert into public.user_legal_consents(user_id,scope,terms_version,privacy_version,rules_version,source) values(owner,'matching_store','2026-10-07','2026-10-07','2026-10-07','matching_consent'),(r.dealer_user_id,'matching_dealer','2026-10-07','2026-10-07','2026-10-07','matching_consent') on conflict do nothing;
 update public.dealer_profiles set published=true,available_regions='東京都',available_hours='QA' where user_id=r.dealer_user_id;
 insert into public.dealer_matching_records(store_id,dealer_user_id,work_start,work_end,store_confirmed_at,dealer_confirmed_at,status,job_snapshot)
 values(r.store_id,r.dealer_user_id,now()-interval '2 days',now()-interval '1 day',now()-interval '3 days',now()-interval '3 days','confirmed',r.job_snapshot) returning id into fixture;
 insert into public.dealer_matching_records(store_id,dealer_user_id,work_start,work_end,store_confirmed_at,dealer_confirmed_at,status) values(r.store_id,r.dealer_user_id,now()+interval '10 days',now()+interval '11 days',now(),now(),'confirmed') returning id into fixture;
 perform set_config('qa.future',fixture::text,true);
 -- Locate the ended fixture independently of the future one.
 select id into fixture from public.dealer_matching_records where store_id=r.store_id and dealer_user_id=r.dealer_user_id and work_start=now()-interval '2 days';
 perform set_config('qa.owner',owner::text,true);perform set_config('qa.dealer',r.dealer_user_id::text,true);perform set_config('qa.outsider',stranger::text,true);perform set_config('qa.record',fixture::text,true);
end $setup$;
set local role authenticated;
do $test$
declare owner uuid:=current_setting('qa.owner')::uuid;dealer uuid:=current_setting('qa.dealer')::uuid;fixture_id uuid:=current_setting('qa.record')::uuid;fail boolean;n int;baseline jsonb;after_review jsonb;stats record;
begin
 perform set_config('request.jwt.claim.sub',owner::text,true);
 baseline:=public.get_dealer_reviews(dealer,0);
 fail:=false;begin perform public.update_spot_work_with_rating(current_setting('qa.future')::uuid,'store','review','Too early',5);exception when sqlstate 'P0001' then fail:=true;end;if not fail then raise exception 'Future work rated';end if;
 fail:=false;begin perform public.update_spot_work(fixture_id,'store','confirm',null);exception when sqlstate 'P0001' then fail:=true;end;if not fail then raise exception 'Chat confirmation guard bypassed';end if;
 foreach n in array array[0,6] loop
  fail:=false;begin perform public.update_spot_work_with_rating(fixture_id,'store','review','QA review',n);exception when sqlstate 'P0001' then fail:=true;end;if not fail then raise exception 'Invalid rating accepted';end if;
 end loop;
 fail:=false;begin perform public.update_spot_work_with_rating(fixture_id,'store','review','QA review',null);exception when sqlstate 'P0001' then fail:=true;end;if not fail then raise exception 'Missing rating accepted';end if;
 fail:=false;begin perform public.update_spot_work(fixture_id,'store','review','QA review');exception when sqlstate 'P0001' then fail:=true;end;if not fail then raise exception 'Legacy API bypassed rating requirement';end if;
 fail:=false;begin perform public.update_spot_work_with_rating(fixture_id,'store','review',' ',5);exception when sqlstate 'P0001' then fail:=true;end;if not fail then raise exception 'Blank review accepted';end if;
 perform public.update_spot_work_with_rating(fixture_id,'store','review','QA store review',5);
 if not exists(select 1 from public.dealer_matching_records where dealer_matching_records.id=fixture_id and store_rating=5 and store_review='QA store review' and dealer_rating is null) then raise exception 'Store rating mixed up';end if;
 after_review:=public.get_dealer_reviews(dealer,0);if after_review<>baseline then raise exception 'Unfinished review published';end if;
 perform public.update_spot_work(fixture_id,'store','complete',null);
 if public.get_dealer_reviews(dealer,0)<>baseline then raise exception 'One-sided completion published';end if;
 perform set_config('request.jwt.claim.sub',current_setting('qa.outsider'),true);
 fail:=false;begin perform public.update_spot_work_with_rating(fixture_id,'dealer','review','QA intruder',1);exception when sqlstate 'P0001' then fail:=true;end;if not fail then raise exception 'Outsider saved review';end if;
 fail:=false;begin perform public.get_dealer_reviews(dealer,0);exception when sqlstate 'P0001' then fail:=true;end;if not fail then raise exception 'Outsider viewed reviews';end if;
 perform set_config('request.jwt.claim.sub',dealer::text,true);
 perform public.update_spot_work_with_rating(fixture_id,'dealer','review','QA dealer review',4);
 if not exists(select 1 from public.dealer_matching_records where dealer_matching_records.id=fixture_id and dealer_rating=4 and store_rating=5) then raise exception 'Reciprocal rating lost';end if;
 perform public.update_spot_work(fixture_id,'dealer','complete',null);
 after_review:=public.get_dealer_reviews(dealer,0);
 if (after_review->>'count')::int<>(baseline->>'count')::int+1 or (after_review->>'rating_count')::int<>(baseline->>'rating_count')::int+1 then raise exception 'Completed review not reflected';end if;
 if abs((after_review->>'average')::numeric-((coalesce((baseline->>'average')::numeric,0)*(baseline->>'rating_count')::int+5)/((baseline->>'rating_count')::int+1)))>0.000001 then raise exception 'Average includes wrong actor';end if;
 select * into stats from public.get_dealer_reputation(array[dealer]);if stats.rating_count<>(after_review->>'rating_count')::int or stats.latest_review->>'review'<>'QA store review' then raise exception 'Search reputation mismatch';end if;
 perform set_config('request.jwt.claim.sub',owner::text,true);
 if (select count(*) from public.get_dealer_reputation(array[dealer,dealer]))<>1 then raise exception 'Duplicate IDs duplicated reputation';end if;
 perform set_config('request.jwt.claim.sub',dealer::text,true);
 fail:=false;begin perform public.update_spot_work_with_rating(fixture_id,'dealer','review','Changed after completion',1);exception when sqlstate 'P0001' then fail:=true;end;if not fail then raise exception 'Completed review editable';end if;
 fail:=false;begin perform public.get_dealer_reviews(dealer,-1);exception when sqlstate 'P0001' then fail:=true;end;if not fail then raise exception 'Negative offset accepted';end if;
 if has_function_privilege('anon','public.get_dealer_reviews(uuid,integer)','EXECUTE') or has_function_privilege('anon','public.get_dealer_reputation(uuid[])','EXECUTE') or has_function_privilege('anon','public.update_spot_work_with_rating(uuid,text,text,text,integer)','EXECUTE') then raise exception 'Anonymous access granted';end if;
end $test$;
reset role;
-- Old text-only history remains available without inventing a rating.
update public.dealer_matching_records set store_rating=null where id=current_setting('qa.record')::uuid;
set local role authenticated;
do $legacy$
declare data jsonb;
begin
 perform set_config('request.jwt.claim.sub',current_setting('qa.dealer'),true);
 data:=public.get_dealer_reviews(current_setting('qa.dealer')::uuid,0);
 if not exists(select 1 from jsonb_array_elements(data->'reviews') j where j->>'id'=current_setting('qa.record') and j->>'rating' is null and j->>'review'='QA store review')then raise exception 'Historical unrated review lost';end if;
end $legacy$;
rollback;
select 'PASS: reciprocal ratings, validation/legacy bypass prevention, participant-only writes, store/self reads, publication after both completions, averages, search projection, immutable finished reviews, anonymous denial and historical unrated reviews; all fixtures rolled back' as verification;
