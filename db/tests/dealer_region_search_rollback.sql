begin;
do $setup$
declare uid uuid;
begin
 select u.id into uid from auth.users u where not exists(select 1 from public.member_status s where s.user_id=u.id and s.suspended) order by u.created_at limit 1;
 if uid is null then raise exception 'QA requires one active account'; end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);
end $setup$;
set local role authenticated;
do $test$
declare failed boolean; p public.dealer_profiles;
begin
 if cardinality(public.dealer_region_lookup('全国'))<>47 or not public.dealer_region_lookup('関西') @> array['大阪府','京都府'] or public.dealer_region_lookup('大阪府以外')<>'{}'::text[] or public.dealer_region_lookup('全国（大阪府を除く）')<>'{}'::text[] then raise exception 'Legacy mapping failed'; end if;
 failed:=false;
 begin
  perform public.save_dealer_profile_with_regions('QA',25,'東京都','QA',array['テキサスホールデム'],2,'',null,'フリーディーラー',true,'{}',null,'','email','',false,'契約可能','ignored','終日','{}','');
 exception when sqlstate 'P0001' then failed:=true; end;
 if not failed then raise exception 'Empty coverage accepted'; end if;
 failed:=false;
 begin
  perform public.save_dealer_profile_with_regions('QA',25,'東京都','QA',array['テキサスホールデム'],2,'',null,'フリーディーラー',true,'{}',null,'','email','',false,'契約可能','ignored','終日',array['不正'],'');
 exception when sqlstate 'P0001' then failed:=true; end;
 if not failed then raise exception 'Invalid coverage accepted'; end if;
 perform public.save_dealer_profile_with_regions('QA',25,'東京都','QA',array['テキサスホールデム'],2,'',null,'フリーディーラー',true,'{}',null,'','email','',false,'契約可能','東京都','平日18:00〜24:00',array['大阪府','京都府','大阪府'],'大阪は市内まで');
 select * into p from public.dealer_profiles where user_id=auth.uid();
 if p.pref<>'東京都' or cardinality(p.available_prefectures)<>2 or not p.available_prefectures @> array['大阪府','京都府'] or p.available_prefectures @> array['東京都'] or p.region_note<>'大阪は市内まで' or position('東京都' in p.available_regions)>0 then raise exception 'Saved coverage differs from selection'; end if;
 if not exists(select 1 from public.dealer_profiles where user_id=auth.uid() and published and available_prefectures @> array['大阪府']) or exists(select 1 from public.dealer_profiles where user_id=auth.uid() and published and available_prefectures @> array['東京都'])then raise exception 'Coverage search still uses home address';end if;
 update public.dealer_profiles set available_regions='京都府' where user_id=auth.uid();
 select * into p from public.dealer_profiles where user_id=auth.uid();
 if p.available_prefectures<>array['京都府'] or p.region_note<>'' then raise exception 'Legacy update left stale coverage';end if;
 perform public.save_dealer_profile_with_regions('QA',25,'東京都','QA',array['テキサスホールデム'],2,'',null,'フリーディーラー',true,'{}',null,'','email','',false,'契約済み','ignored','終日',public.dealer_region_lookup('全国'),repeat('あ',100));
 if not exists(select 1 from public.dealer_profiles where user_id=auth.uid() and cardinality(available_prefectures)=47 and contract_status='契約済み')then raise exception 'Nationwide/status save failed';end if;
 if has_function_privilege('anon','public.save_dealer_profile_with_regions(text,integer,text,text,text[],numeric,text,text,text,boolean,date[],text,text,text,text,boolean,text,text,text,text[],text)','EXECUTE') then raise exception 'Anonymous save allowed'; end if;
 if exists(select 1 from pg_proc where oid='public.save_dealer_profile_with_regions(text,integer,text,text,text[],numeric,text,text,text,boolean,date[],text,text,text,text,boolean,text,text,text,text[],text)'::regprocedure and prosecdef) then raise exception 'Save must preserve RLS'; end if;
end $test$;
rollback;
select 'PASS: prefecture/region/nationwide mapping, exclusion safety, coverage independent of residence, required selections, deduplication, notes, old-client sync, and authenticated invoker access; all test changes rolled back' as verification;
