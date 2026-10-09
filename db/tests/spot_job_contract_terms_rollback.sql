begin;
do $$
declare r public.dealer_matching_records; j public.spot_jobs; owner uuid; fixture uuid; room uuid; t public.dealer_chat_terms; denied boolean:=false;
begin
 select * into r from public.dealer_matching_records order by created_at desc limit 1;
 select * into j from public.spot_jobs where id=r.spot_job_id;
 select owner_user_id into owner from public.stores where id=r.store_id;
 if j.id is null or owner is null then raise exception 'Missing QA source'; end if;
 perform set_config('request.jwt.claim.sub',owner::text,true);
 begin
  perform public.save_spot_job_with_terms(null,r.store_id,j.games,j.duties,j.requirements,j.transport_type,j.transport_limit,j.dress,now()+interval '9 days',null,false,'[]','{}');
 exception when sqlstate 'P0001' then denied:=true; end;
 if not denied then raise exception 'Missing terms accepted'; end if;
 fixture:=public.save_spot_job_with_terms(null,r.store_id,j.games,j.duties,j.requirements,j.transport_type,j.transport_limit,j.dress,now()+interval '9 days',null,false,
 jsonb_build_array(jsonb_build_object('work_date',(now()+interval '10 days')::date,'start_time','18:00','end_time','22:00','break_minutes',0,'hourly_wage',1500,'headcount',1)),
 '{"contract_type":"contract","payment_method":"cash","payment_date":"即日","notes":"なし"}');
 if not exists(select 1 from public.spot_jobs where id=fixture and contract_type='contract' and payment_date='即日' and contract_notes='なし') then raise exception 'Terms not saved'; end if;
 insert into public.dealer_matching_records(store_id,dealer_user_id,spot_job_id,work_start,work_end) values(r.store_id,r.dealer_user_id,fixture,now()+interval '10 days',now()+interval '10 days 4 hours') returning id into room;
 select * into t from public.dealer_chat_terms where record_id=room;
 if t.record_id is null or t.revision<>1 or t.contract_type<>'contract' or t.payment_date<>'即日' or t.updated_by<>owner then raise exception 'Chat terms not seeded'; end if;
 perform set_config('qa.owner',owner::text,true);perform set_config('qa.dealer',r.dealer_user_id::text,true);perform set_config('qa.room',room::text,true);
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000000',true);
do $$ begin
 if exists(select 1 from public.dealer_private_contacts) or exists(select 1 from public.dealer_chat_terms) then raise exception 'Private data leaked';end if;
end $$;
rollback;
select 'PASS: required terms validated, draft saved, application/offer trigger seeds revision 1, unrelated contacts/terms denied; all fixtures rolled back' as verification;
