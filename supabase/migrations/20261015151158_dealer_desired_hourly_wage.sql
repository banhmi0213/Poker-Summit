alter table public.dealer_profiles
 add column desired_hourly_wage_min integer,
 add column desired_hourly_wage_max integer,
 add constraint dealer_desired_hourly_wage_valid check (
 (desired_hourly_wage_min is null and desired_hourly_wage_max is null)
 or (desired_hourly_wage_min is not null and desired_hourly_wage_max is not null
 and desired_hourly_wage_min between 1200 and 2500 and desired_hourly_wage_max between 1200 and 2500
 and desired_hourly_wage_min % 100 = 0 and desired_hourly_wage_max % 100 = 0
 and desired_hourly_wage_min <= desired_hourly_wage_max));
create function public.save_dealer_profile_with_wage(
 p_name text,p_age integer,p_pref text,p_address text,p_games text[],p_years numeric,p_appeal text,p_photo text,p_type text,p_published boolean,p_dates date[],p_avatar text,p_phone text,p_contact_type text,p_contact_value text,p_disclose boolean,p_contract_status text,p_regions text,p_hours text,p_prefectures text[],p_region_note text,p_wage_min integer,p_wage_max integer)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or public.is_suspended() then raise exception '登録できません。'; end if;
 perform public.save_dealer_profile_with_regions(p_name,p_age,p_pref,p_address,p_games,p_years,p_appeal,p_photo,p_type,p_published,p_dates,p_avatar,p_phone,p_contact_type,p_contact_value,p_disclose,p_contract_status,p_regions,p_hours,p_prefectures,p_region_note);
 update public.dealer_profiles set desired_hourly_wage_min=p_wage_min,desired_hourly_wage_max=p_wage_max where user_id=auth.uid();
 if not found then raise exception '登録情報を保存できませんでした。'; end if;
end;
$$;
revoke all on function public.save_dealer_profile_with_wage(text,integer,text,text,text[],numeric,text,text,text,boolean,date[],text,text,text,text,boolean,text,text,text,text[],text,integer,integer) from public,anon;
grant execute on function public.save_dealer_profile_with_wage(text,integer,text,text,text[],numeric,text,text,text,boolean,date[],text,text,text,text,boolean,text,text,text,text[],text,integer,integer) to authenticated;
