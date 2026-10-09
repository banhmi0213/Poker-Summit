alter table public.dealer_profiles
 add column available_prefectures text[] not null default '{}'::text[]
  check(cardinality(available_prefectures)<=47 and array_position(available_prefectures,null) is null and available_prefectures <@ array['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県']::text[]),
 add column region_note text not null default '' check(char_length(region_note)<=100);

-- Conservative compatibility mapping: no address fallback and no guessing about prose/exclusions.
create function public.dealer_region_lookup(p_text text) returns text[]
language sql immutable security invoker set search_path='' as $$
 with tokens as (select regexp_split_to_table(btrim(coalesce(p_text,'')), '[・、,，/／;；[:space:]]+') as token),
 aliases as (select '{"北海道": ["北海道"], "青森県": ["青森県"], "青森": ["青森県"], "岩手県": ["岩手県"], "岩手": ["岩手県"], "宮城県": ["宮城県"], "宮城": ["宮城県"], "秋田県": ["秋田県"], "秋田": ["秋田県"], "山形県": ["山形県"], "山形": ["山形県"], "福島県": ["福島県"], "福島": ["福島県"], "茨城県": ["茨城県"], "茨城": ["茨城県"], "栃木県": ["栃木県"], "栃木": ["栃木県"], "群馬県": ["群馬県"], "群馬": ["群馬県"], "埼玉県": ["埼玉県"], "埼玉": ["埼玉県"], "千葉県": ["千葉県"], "千葉": ["千葉県"], "東京都": ["東京都"], "東京": ["東京都"], "神奈川県": ["神奈川県"], "神奈川": ["神奈川県"], "新潟県": ["新潟県"], "新潟": ["新潟県"], "富山県": ["富山県"], "富山": ["富山県"], "石川県": ["石川県"], "石川": ["石川県"], "福井県": ["福井県"], "福井": ["福井県"], "山梨県": ["山梨県"], "山梨": ["山梨県"], "長野県": ["長野県"], "長野": ["長野県"], "岐阜県": ["岐阜県"], "岐阜": ["岐阜県"], "静岡県": ["静岡県"], "静岡": ["静岡県"], "愛知県": ["愛知県"], "愛知": ["愛知県"], "三重県": ["三重県"], "三重": ["三重県"], "滋賀県": ["滋賀県"], "滋賀": ["滋賀県"], "京都府": ["京都府"], "京都": ["京都府"], "大阪府": ["大阪府"], "大阪": ["大阪府"], "兵庫県": ["兵庫県"], "兵庫": ["兵庫県"], "奈良県": ["奈良県"], "奈良": ["奈良県"], "和歌山県": ["和歌山県"], "和歌山": ["和歌山県"], "鳥取県": ["鳥取県"], "鳥取": ["鳥取県"], "島根県": ["島根県"], "島根": ["島根県"], "岡山県": ["岡山県"], "岡山": ["岡山県"], "広島県": ["広島県"], "広島": ["広島県"], "山口県": ["山口県"], "山口": ["山口県"], "徳島県": ["徳島県"], "徳島": ["徳島県"], "香川県": ["香川県"], "香川": ["香川県"], "愛媛県": ["愛媛県"], "愛媛": ["愛媛県"], "高知県": ["高知県"], "高知": ["高知県"], "福岡県": ["福岡県"], "福岡": ["福岡県"], "佐賀県": ["佐賀県"], "佐賀": ["佐賀県"], "長崎県": ["長崎県"], "長崎": ["長崎県"], "熊本県": ["熊本県"], "熊本": ["熊本県"], "大分県": ["大分県"], "大分": ["大分県"], "宮崎県": ["宮崎県"], "宮崎": ["宮崎県"], "鹿児島県": ["鹿児島県"], "鹿児島": ["鹿児島県"], "沖縄県": ["沖縄県"], "沖縄": ["沖縄県"], "北海道・東北": ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"], "関東": ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"], "中部": ["新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県"], "近畿": ["三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"], "中国": ["鳥取県", "島根県", "岡山県", "広島県", "山口県"], "四国": ["徳島県", "香川県", "愛媛県", "高知県"], "九州・沖縄": ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"], "関西": ["三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"], "全国": ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"], "東北": ["青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"], "九州": ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県"]}'::jsonb as mapping),
 resolved as (select distinct jsonb_array_elements_text(mapping->token) as pref from tokens cross join aliases)
 select case when exists(select 1 from tokens cross join aliases where not (mapping ? token)) then '{}'::text[]
 else coalesce((select array_agg(pref order by array_position(array['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県']::text[],pref)) from resolved),'{}'::text[]) end;
$$;
revoke all on function public.dealer_region_lookup(text) from public,anon;
grant execute on function public.dealer_region_lookup(text) to authenticated,service_role;

-- Old clients must not leave stale region assignments after changing their free text.
create function private.sync_dealer_search_regions() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' or new.available_regions is distinct from old.available_regions then
  new.available_prefectures:=public.dealer_region_lookup(new.available_regions);
  new.region_note:='';
 end if;
 return new;
end;
$$;
revoke all on function private.sync_dealer_search_regions() from public,anon,authenticated;
create trigger sync_dealer_search_regions before insert or update of available_regions on public.dealer_profiles
 for each row execute function private.sync_dealer_search_regions();

-- Existing blank/ambiguous profiles stay unassigned until their owner selects regions.
update public.dealer_profiles set available_prefectures=public.dealer_region_lookup(available_regions)
 where dealer_type<>'フリーディーラー' or char_length(btrim(available_regions,E' \t\n\r　'))>0;
create index dealer_profiles_available_prefectures on public.dealer_profiles using gin(available_prefectures) where published;

create function public.save_dealer_profile_with_regions(
 p_name text,p_age integer,p_pref text,p_address text,p_games text[],p_years numeric,
 p_appeal text,p_photo text,p_type text,p_published boolean,p_dates date[],p_avatar text,
 p_phone text,p_contact_type text,p_contact_value text,p_disclose boolean,
 p_contract_status text,p_regions text,p_hours text,p_prefectures text[],p_region_note text
) returns void language plpgsql security invoker set search_path='' as $$
declare canonical text[]; display_regions text;
begin
 if auth.uid() is null or public.is_suspended() then raise exception '登録できません。'; end if;
 if p_prefectures is null or cardinality(p_prefectures)>47 or array_position(p_prefectures,null) is not null or not p_prefectures <@ array['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県']::text[] or (p_type='フリーディーラー' and cardinality(p_prefectures)=0) then raise exception '対応可能な都道府県を選択してください。'; end if;
 if p_region_note is null or char_length(p_region_note)>100 then raise exception '地域の補足を確認してください。'; end if;
 canonical:=array(select distinct p from unnest(p_prefectures) p order by p);
 display_regions:=array_to_string(canonical,'・') || case when btrim(p_region_note)<>'' then '（' || btrim(p_region_note) || '）' else '' end;
 perform public.save_dealer_profile_with_availability(p_name,p_age,p_pref,p_address,p_games,p_years,p_appeal,p_photo,p_type,p_published,p_dates,p_avatar,p_phone,p_contact_type,p_contact_value,p_disclose,p_contract_status,display_regions,p_hours);
 update public.dealer_profiles set available_prefectures=canonical,region_note=btrim(p_region_note) where user_id=auth.uid();
end;
$$;
revoke all on function public.save_dealer_profile_with_regions(text,integer,text,text,text[],numeric,text,text,text,boolean,date[],text,text,text,text,boolean,text,text,text,text[],text) from public,anon;
grant execute on function public.save_dealer_profile_with_regions(text,integer,text,text,text[],numeric,text,text,text,boolean,date[],text,text,text,text,boolean,text,text,text,text[],text) to authenticated;
