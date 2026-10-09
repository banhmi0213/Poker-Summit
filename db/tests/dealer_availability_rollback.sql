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
 failed:=false;
 begin
  perform public.save_dealer_profile_with_availability('QA',25,'大阪府','QA',array['テキサスホールデム'],2,'',null,'フリーディーラー',true,'{}',null,'','email','',false,'契約可能','','終日');
 exception when sqlstate 'P0001' then failed:=true; end;
 if not failed then raise exception 'Missing region accepted'; end if;
 failed:=false;
 begin
  perform public.save_dealer_profile_with_availability('QA',25,'大阪府','QA',array['テキサスホールデム'],2,'',null,'フリーディーラー',true,'{}',null,'','email','',false,'契約可能','大阪府',E' \t\n　');
 exception when sqlstate 'P0001' then failed:=true; end;
 if not failed then raise exception 'Blank hours accepted'; end if;
 failed:=false;
 begin
  perform public.save_dealer_profile_with_availability('QA',25,'大阪府','QA',array['テキサスホールデム'],2,'',null,'フリーディーラー',true,'{}',null,'','email','',false,'invalid','大阪府','終日');
 exception when sqlstate 'P0001' then failed:=true; end;
 if not failed then raise exception 'Invalid status accepted'; end if;
 perform public.save_dealer_profile_with_availability('QA',25,'大阪府','QA',array['テキサスホールデム'],2,'',null,'フリーディーラー',true,'{}',null,'','email','',false,'契約可能',' 大阪府・京都府 ',E'平日18:00〜翌2:00\n土日終日');
 select * into p from public.dealer_profiles where user_id=auth.uid();
 if p.contract_status<>'契約可能' or p.available_regions<>'大阪府・京都府' or p.available_hours<>E'平日18:00〜翌2:00\n土日終日' then raise exception 'Round trip failed'; end if;
 perform public.save_dealer_profile_with_availability('QA',25,'大阪府','QA',array['テキサスホールデム'],2,'',null,'フリーディーラー',true,'{}',null,'','email','',false,'契約済み','大阪府','土日終日');
 if not exists(select 1 from public.dealer_profiles where user_id=auth.uid() and contract_status='契約済み')then raise exception 'Status switch failed';end if;
 failed:=false;
 begin update public.dealer_profiles set available_regions='' where user_id=auth.uid();
 exception when check_violation then failed:=true; end;
 if not failed then raise exception 'Direct write bypassed requirement'; end if;
 perform public.save_dealer_profile_with_availability('QA',25,'大阪府','QA',array['テキサスホールデム'],2,'',null,'ディーラー',true,'{}',null,'','email','',false,'契約可能','','');
 if has_function_privilege('anon','public.save_dealer_profile_with_availability(text,integer,text,text,text[],numeric,text,text,text,boolean,date[],text,text,text,text,boolean,text,text,text)','EXECUTE') then raise exception 'Anonymous save allowed'; end if;
 if exists(select 1 from pg_proc where oid='public.save_dealer_profile_with_availability(text,integer,text,text,text[],numeric,text,text,text,boolean,date[],text,text,text,text,boolean,text,text,text)'::regprocedure and prosecdef) then raise exception 'Save must use RLS'; end if;
end $test$;
rollback;
select 'PASS: required regions/hours, whitespace and status validation, create/update round trip, status switching, direct-write constraints, normal dealer optional fields, anonymous denial and RLS; all data rolled back' as verification;
