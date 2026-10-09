-- Dealer-authored recruiting status, separate from verified matching records.
alter table public.dealer_profiles
 add column contract_status text not null default '契約可能'
  check (contract_status in ('契約可能','契約済み')),
 add column available_regions text not null default '' check (char_length(available_regions)<=300),
 add column available_hours text not null default '' check (char_length(available_hours)<=500);

-- Preserve existing incomplete profiles; require both fields on future writes.
alter table public.dealer_profiles add constraint freelance_availability_required
 check (dealer_type<>'フリーディーラー' or
  (char_length(btrim(available_regions, E' \t\n\r　'))>0 and char_length(btrim(available_hours, E' \t\n\r　'))>0)) not valid;

-- All profile, address, contact and recruiting fields are saved atomically under RLS.
create function public.save_dealer_profile_with_availability(
 p_name text,p_age integer,p_pref text,p_address text,p_games text[],p_years numeric,
 p_appeal text,p_photo text,p_type text,p_published boolean,p_dates date[],p_avatar text,
 p_phone text,p_contact_type text,p_contact_value text,p_disclose boolean,
 p_contract_status text,p_regions text,p_hours text
) returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or public.is_suspended() then raise exception '登録できません。'; end if;
 if p_contract_status is null or p_contract_status not in ('契約可能','契約済み') or p_regions is null or char_length(p_regions)>300 or p_hours is null or char_length(p_hours)>500 then raise exception '募集状況を確認してください。'; end if;
 if p_type='フリーディーラー' and (char_length(btrim(p_regions, E' \t\n\r　'))=0 or char_length(btrim(p_hours, E' \t\n\r　'))=0) then raise exception '対応可能地域と対応可能時間を入力してください。'; end if;
 if p_dates is null or cardinality(p_dates)>366 or array_position(p_dates,null) is not null then raise exception '希望勤務日を確認してください。'; end if;
 if p_avatar is not null and p_avatar not in ('male','female') then raise exception 'シルエットを確認してください。'; end if;
 if p_phone is null or length(p_phone)>30 or (p_phone<>'' and p_phone !~ '^\+?[0-9]{7,15}$') or p_contact_type is null or p_contact_type not in ('line','email') or p_contact_value is null or length(p_contact_value)>254 or (p_contact_value<>'' and (p_contact_value ~ '[[:space:]]' or (p_contact_type='email' and p_contact_value !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'))) then raise exception '連絡先を確認してください。'; end if;
 if p_disclose and (p_phone='' or p_contact_value='') then raise exception '開示に同意する場合は電話番号とLINEまたはメールアドレスを入力してください。'; end if;
 insert into public.dealer_profiles(user_id,full_name,age,pref,games,experience_years,appeal,photo_url,dealer_type,published,available_dates,avatar_kind,contract_status,available_regions,available_hours)
 values(auth.uid(),p_name,p_age,p_pref,p_games,p_years,p_appeal,case when p_avatar is null then p_photo else null end,p_type,p_published,array(select distinct d from unnest(p_dates) d order by d),p_avatar,p_contract_status,btrim(p_regions, E' \t\n\r　'),btrim(p_hours, E' \t\n\r　'))
 on conflict(user_id) do update set full_name=excluded.full_name,age=excluded.age,pref=excluded.pref,games=excluded.games,experience_years=excluded.experience_years,appeal=excluded.appeal,photo_url=excluded.photo_url,dealer_type=excluded.dealer_type,published=excluded.published,available_dates=excluded.available_dates,avatar_kind=excluded.avatar_kind,contract_status=excluded.contract_status,available_regions=excluded.available_regions,available_hours=excluded.available_hours,updated_at=now();
 insert into public.dealer_addresses(user_id,address) values(auth.uid(),p_address)
 on conflict(user_id) do update set address=excluded.address;
 insert into public.profiles(user_id,role,updated_at) values(auth.uid(),p_type,now())
 on conflict(user_id) do update set role=excluded.role,updated_at=now();
 insert into public.dealer_private_contacts(user_id,phone,contact_type,contact_value,disclosure_consented_at,disclosure_version)
 values(auth.uid(),p_phone,p_contact_type,p_contact_value,case when p_disclose then now() else null end,case when p_disclose then '2026-10-07-contact-v1' else null end)
 on conflict(user_id) do update set phone=excluded.phone,contact_type=excluded.contact_type,contact_value=excluded.contact_value,disclosure_consented_at=case when p_disclose then coalesce(dealer_private_contacts.disclosure_consented_at,now()) else null end,disclosure_version=excluded.disclosure_version,updated_at=now();
end;
$$;
revoke all on function public.save_dealer_profile_with_availability(text,integer,text,text,text[],numeric,text,text,text,boolean,date[],text,text,text,text,boolean,text,text,text) from public,anon;
grant execute on function public.save_dealer_profile_with_availability(text,integer,text,text,text[],numeric,text,text,text,boolean,date[],text,text,text,text,boolean,text,text,text) to authenticated;
