alter table public.dealer_profiles add column available_dates date[] not null default '{}'::date[] check(cardinality(available_dates)<=366);
create function public.save_dealer_profile_with_dates(p_name text,p_age integer,p_pref text,p_address text,p_games text[],p_years numeric,p_appeal text,p_photo text,p_type text,p_published boolean,p_dates date[])
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_dates is null or cardinality(p_dates)>366 or array_position(p_dates,null) is not null then raise exception '希望勤務日を確認してください。'; end if;
 perform public.save_dealer_profile(p_name,p_age,p_pref,p_address,p_games,p_years,p_appeal,p_photo,p_type,p_published);
 update public.dealer_profiles set available_dates=array(select distinct d from unnest(p_dates) d order by d) where user_id=auth.uid();
end;
$$;
revoke all on function public.save_dealer_profile_with_dates(text,integer,text,text,text[],numeric,text,text,text,boolean,date[]) from public,anon;
grant execute on function public.save_dealer_profile_with_dates(text,integer,text,text,text[],numeric,text,text,text,boolean,date[]) to authenticated;