CREATE OR REPLACE FUNCTION private.chat_ready(p_record uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select private.chat_actor(p_record) is not null
 and exists(select 1 from public.dealer_chat_consents c where c.record_id=p_record and c.user_id=auth.uid() and c.version='2026-10-08-chat-v1')
 and exists(select 1 from public.user_legal_consents c where c.user_id=auth.uid() and c.scope='matching_'||private.chat_actor(p_record) and c.terms_version='2026-10-09' and c.privacy_version='2026-10-09' and c.rules_version='2026-10-09');
$function$

CREATE OR REPLACE FUNCTION private.capture_signup_legal_consent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 -- Capture the initial declaration only. Editable Auth metadata is never used
 -- later as an authorization check or as the authoritative consent record.
 if new.raw_user_meta_data->>'legal_consent'='true'
  and new.raw_user_meta_data->>'terms_version' in ('2026-10-07','2026-10-09')
  and new.raw_user_meta_data->>'privacy_version'=new.raw_user_meta_data->>'terms_version' then
  insert into public.user_legal_consents(user_id,scope,terms_version,privacy_version,source)
  values(new.id,'signup',new.raw_user_meta_data->>'terms_version',new.raw_user_meta_data->>'privacy_version','registration');
 end if;
 return new;
end;
$function$

CREATE OR REPLACE FUNCTION public.record_matching_consent(p_actor text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result uuid;
begin
 if auth.uid() is null or public.is_suspended() then raise exception '利用できません。'; end if;
 if p_actor='store' then
  if not exists(select 1 from public.stores where owner_user_id=auth.uid()) then raise exception '店舗アカウントが必要です。'; end if;
 elsif p_actor='dealer' then
  if not exists(select 1 from public.dealer_profiles where user_id=auth.uid()) then raise exception 'ディーラー登録が必要です。'; end if;
 else raise exception '利用区分を確認してください。'; end if;
 insert into public.user_legal_consents(user_id,scope,terms_version,privacy_version,rules_version,source)
 values(auth.uid(),'matching_'||p_actor,'2026-10-09','2026-10-09','2026-10-09','matching_consent')
 on conflict(user_id,scope,terms_version,privacy_version,rules_version) do nothing;
 select id into result from public.user_legal_consents where user_id=auth.uid()
  and scope='matching_'||p_actor and terms_version='2026-10-09'
  and privacy_version='2026-10-09' and rules_version='2026-10-09';
 return result;
end;
$function$

alter table public.dealer_profiles add constraint dealer_profiles_adult_age check(age >=18);
