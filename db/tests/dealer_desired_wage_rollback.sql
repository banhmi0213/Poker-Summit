begin;
do $$ declare uid uuid; begin
select u.id into uid from auth.users u where not exists(select 1 from public.member_status s where s.user_id=u.id and s.suspended) order by u.created_at limit 1;
if uid is null then raise exception 'No active QA account'; end if;
perform set_config('request.jwt.claim.sub',uid::text,true);end $$;
set local role authenticated;
do $$ declare failed boolean; pair integer[]; begin
perform public.save_dealer_profile_with_wage('QA Wage',25,'東京都','QA',array['テキサスホールデム'],2,'QA',null,'フリーディーラー',true,'{}',null,'','email','',false,'契約可能','大阪府','終日',array['大阪府'],'',1200,2500);
if not exists(select 1 from public.dealer_profiles where user_id=auth.uid() and desired_hourly_wage_min=1200 and desired_hourly_wage_max=2500) then raise exception 'Save failed'; end if;
foreach pair slice 1 in array array[[2500,1200],[1100,2500],[1200,2600],[1250,2500],[1200,null],[null,2500]] loop
failed:=false;
begin
perform public.save_dealer_profile_with_wage('Must roll back',25,'東京都','QA',array['テキサスホールデム'],2,'QA',null,'フリーディーラー',true,'{}',null,'','email','',false,'契約可能','大阪府','終日',array['大阪府'],'',pair[1],pair[2]);
exception when check_violation then failed:=true; end;
if not failed then raise exception 'Invalid wage accepted: %',pair;end if;
if not exists(select 1 from public.dealer_profiles where user_id=auth.uid() and full_name='QA Wage' and desired_hourly_wage_min=1200 and desired_hourly_wage_max=2500)then raise exception 'Atomic rollback failed';end if;
end loop;
perform public.save_dealer_profile_with_wage('QA Wage',25,'東京都','QA',array['テキサスホールデム'],2,'QA',null,'フリーディーラー',true,'{}',null,'','email','',false,'契約可能','大阪府','終日',array['大阪府'],'',2500,2500);
perform public.save_dealer_profile_with_wage('QA Wage',25,'東京都','QA',array['テキサスホールデム'],2,'QA',null,'フリーディーラー',true,'{}',null,'','email','',false,'契約可能','大阪府','終日',array['大阪府'],'',null,null);
if not exists(select 1 from public.dealer_profiles where user_id=auth.uid() and desired_hourly_wage_min is null and desired_hourly_wage_max is null)then raise exception 'Clear failed';end if;
if has_function_privilege('anon','public.save_dealer_profile_with_wage(text,integer,text,text,text[],numeric,text,text,text,boolean,date[],text,text,text,text,boolean,text,text,text,text[],text,integer,integer)','EXECUTE')then raise exception 'Anon execute granted';end if;
end $$;
rollback;
select 'PASS: wage save, equal bounds, clearing, invalid range/step/partial values rejected, atomic rollback and anonymous access blocked. All test changes rolled back.' as verification;
