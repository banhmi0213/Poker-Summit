create table public.user_legal_consents (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null,
 scope text not null check(scope in ('signup','matching_store','matching_dealer')),
 terms_version text not null,
 privacy_version text not null,
 rules_version text not null default '',
 accepted_at timestamptz not null default now(),
 source text not null check(source in ('registration','matching_consent')),
 unique(user_id,scope,terms_version,privacy_version,rules_version)
);
-- No FK cascade: withdrawal does not automatically erase required audit records.
alter table public.user_legal_consents enable row level security;
revoke all on public.user_legal_consents from public,anon,authenticated;
grant select on public.user_legal_consents to authenticated;
grant all on public.user_legal_consents to service_role;
create policy legal_consent_own_read on public.user_legal_consents for select to authenticated
 using(user_id=(select auth.uid()));

create schema if not exists private;
create function private.capture_signup_legal_consent() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 -- Capture the initial declaration only. Editable Auth metadata is never used
 -- later as an authorization check or as the authoritative consent record.
 if new.raw_user_meta_data->>'legal_consent'='true'
  and new.raw_user_meta_data->>'terms_version'='2026-10-07'
  and new.raw_user_meta_data->>'privacy_version'='2026-10-07' then
  insert into public.user_legal_consents(user_id,scope,terms_version,privacy_version,source)
  values(new.id,'signup','2026-10-07','2026-10-07','registration');
 end if;
 return new;
end;
$$;
revoke all on function private.capture_signup_legal_consent() from public,anon,authenticated;
create trigger capture_signup_legal_consent after insert on auth.users
 for each row execute function private.capture_signup_legal_consent();

create function public.record_matching_consent(p_actor text) returns uuid
 language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null or public.is_suspended() then raise exception '利用できません。'; end if;
 if p_actor='store' then
  if not exists(select 1 from public.stores where owner_user_id=auth.uid()) then raise exception '店舗アカウントが必要です。'; end if;
 elsif p_actor='dealer' then
  if not exists(select 1 from public.dealer_profiles where user_id=auth.uid()) then raise exception 'ディーラー登録が必要です。'; end if;
 else raise exception '利用区分を確認してください。'; end if;
 insert into public.user_legal_consents(user_id,scope,terms_version,privacy_version,rules_version,source)
 values(auth.uid(),'matching_'||p_actor,'2026-10-07','2026-10-07','2026-10-07','matching_consent')
 on conflict(user_id,scope,terms_version,privacy_version,rules_version) do nothing;
 select id into result from public.user_legal_consents where user_id=auth.uid()
  and scope='matching_'||p_actor and terms_version='2026-10-07'
  and privacy_version='2026-10-07' and rules_version='2026-10-07';
 return result;
end;
$$;
-- Definer is limited to appending server-timestamped consent for auth.uid().
-- Clients have no INSERT/UPDATE/DELETE grants and cannot set IDs or timestamps.
revoke all on function public.record_matching_consent(text) from public,anon;
grant execute on function public.record_matching_consent(text) to authenticated;
