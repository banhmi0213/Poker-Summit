-- Avatar choice is an image preference, separate from gender or authorization.
alter table public.dealer_profiles add column avatar_kind text
 check (avatar_kind in ('male','female'));

create function public.save_dealer_profile_with_avatar(
 p_name text,p_age integer,p_pref text,p_address text,p_games text[],p_years numeric,
 p_appeal text,p_photo text,p_type text,p_published boolean,p_dates date[],p_avatar text
) returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_avatar is not null and p_avatar not in ('male','female') then
  raise exception 'シルエットを確認してください。';
 end if;
 perform public.save_dealer_profile_with_dates(p_name,p_age,p_pref,p_address,p_games,p_years,
  p_appeal,case when p_avatar is null then p_photo else null end,p_type,p_published,p_dates);
 update public.dealer_profiles set avatar_kind=p_avatar where user_id=auth.uid();
end;
$$;
revoke all on function public.save_dealer_profile_with_avatar(text,integer,text,text,text[],numeric,text,text,text,boolean,date[],text) from public,anon;
grant execute on function public.save_dealer_profile_with_avatar(text,integer,text,text,text[],numeric,text,text,text,boolean,date[],text) to authenticated;
