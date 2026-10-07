-- Private contact details never belong in the store-readable profile table.
create table public.dealer_private_contacts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 phone text not null default '' check(length(phone)<=30),
 contact_type text not null default 'email' check(contact_type in ('line','email')),
 contact_value text not null default '' check(length(contact_value)<=254),
 disclosure_consented_at timestamptz,
 disclosure_version text,
 updated_at timestamptz not null default now()
);
alter table public.dealer_private_contacts enable row level security;
revoke all on public.dealer_private_contacts from public,anon,authenticated;
grant select,insert,update on public.dealer_private_contacts to authenticated;
grant all on public.dealer_private_contacts to service_role;
create policy dealer_contacts_own_select on public.dealer_private_contacts for select to authenticated using(user_id=(select auth.uid()) and not (select public.is_suspended()));
create policy dealer_contacts_own_insert on public.dealer_private_contacts for insert to authenticated with check(user_id=(select auth.uid()) and not (select public.is_suspended()));
create policy dealer_contacts_own_update on public.dealer_private_contacts for update to authenticated using(user_id=(select auth.uid()) and not (select public.is_suspended())) with check(user_id=(select auth.uid()) and not (select public.is_suspended()));

create function private.stamp_dealer_contact_consent() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.disclosure_consented_at is not null then
  if tg_op='UPDATE' and old.disclosure_consented_at is not null then new.disclosure_consented_at:=old.disclosure_consented_at;
  else new.disclosure_consented_at:=now(); end if;
  new.disclosure_version:='2026-10-07-contact-v1';
 else new.disclosure_version:=null; end if;
 new.updated_at:=now();
 return new;
end;
$$;
revoke all on function private.stamp_dealer_contact_consent() from public,anon,authenticated;
create trigger stamp_dealer_contact_consent before insert or update on public.dealer_private_contacts for each row execute function private.stamp_dealer_contact_consent();

-- Canonical matching outcomes. Client accounts cannot manufacture confirmations
-- or attendance results. The matching workflow must write verified events here.
create table public.dealer_matching_records (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.stores(id),
 dealer_user_id uuid not null references auth.users(id),
 work_start timestamptz not null,
 work_end timestamptz not null check(work_end>work_start),
 store_confirmed_at timestamptz,
 dealer_confirmed_at timestamptz,
 status text not null default 'pending' check(status in ('pending','confirmed','completed','dealer_cancelled','store_cancelled','no_show_pending','no_show_verified','disputed')),
 outcome_at timestamptz,
 cancellation_notice_at timestamptz,
 verified_at timestamptz,
 verified_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 check(status='pending' or (store_confirmed_at is not null and dealer_confirmed_at is not null)),
 check(status not in ('completed','dealer_cancelled','store_cancelled','no_show_verified') or outcome_at is not null),
 check(status<>'dealer_cancelled' or cancellation_notice_at is not null),
 check(status<>'no_show_verified' or (verified_at is not null and verified_by is not null and cancellation_notice_at is null))
);
create index dealer_matching_records_dealer_status on public.dealer_matching_records(dealer_user_id,status);
create index dealer_matching_records_store on public.dealer_matching_records(store_id);
alter table public.dealer_matching_records enable row level security;
revoke all on public.dealer_matching_records from public,anon,authenticated;
grant select on public.dealer_matching_records to authenticated;
grant all on public.dealer_matching_records to service_role;
create policy matching_record_participant_read on public.dealer_matching_records for select to authenticated using(not (select public.is_suspended()) and (dealer_user_id=(select auth.uid()) or exists(select 1 from public.stores s where s.id=store_id and s.owner_user_id=(select auth.uid()))));

create function public.save_dealer_profile_with_contacts(p_name text,p_age integer,p_pref text,p_address text,p_games text[],p_years numeric,p_appeal text,p_photo text,p_type text,p_published boolean,p_dates date[],p_avatar text,p_phone text,p_contact_type text,p_contact_value text,p_disclose boolean)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or public.is_suspended() then raise exception '登録できません。'; end if;
 if p_phone is null or length(p_phone)>30 or (p_phone<>'' and p_phone !~ '^\+?[0-9]{7,15}$') or p_contact_type not in ('line','email') or p_contact_value is null or length(p_contact_value)>254 or (p_contact_value<>'' and (p_contact_value ~ '[[:space:]]' or (p_contact_type='email' and p_contact_value !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'))) then raise exception '連絡先を確認してください。'; end if;
 if p_disclose and (p_phone='' or p_contact_value='') then raise exception '開示に同意する場合は電話番号とLINEまたはメールアドレスを入力してください。'; end if;
 perform public.save_dealer_profile_with_avatar(p_name,p_age,p_pref,p_address,p_games,p_years,p_appeal,p_photo,p_type,p_published,p_dates,p_avatar);
 insert into public.dealer_private_contacts(user_id,phone,contact_type,contact_value,disclosure_consented_at,disclosure_version)
 values(auth.uid(),p_phone,p_contact_type,p_contact_value,case when p_disclose then now() else null end,case when p_disclose then '2026-10-07-contact-v1' else null end)
 on conflict(user_id) do update set phone=excluded.phone,contact_type=excluded.contact_type,contact_value=excluded.contact_value,disclosure_consented_at=case when p_disclose then coalesce(dealer_private_contacts.disclosure_consented_at,now()) else null end,disclosure_version=excluded.disclosure_version,updated_at=now();
end;
$$;
revoke all on function public.save_dealer_profile_with_contacts(text,integer,text,text,text[],numeric,text,text,text,boolean,date[],text,text,text,text,boolean) from public,anon;
grant execute on function public.save_dealer_profile_with_contacts(text,integer,text,text,text[],numeric,text,text,text,boolean,date[],text,text,text,text,boolean) to authenticated;

-- Restricted definer: only the owner of the confirmed client store may receive
-- opted-in contacts for this particular record. No arbitrary dealer lookup.
create function public.get_matching_dealer_contacts(p_record_id uuid)
returns table(phone text,contact_type text,contact_value text) language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.is_suspended() then raise exception '閲覧できません。'; end if;
 return query select c.phone,c.contact_type,c.contact_value from public.dealer_matching_records r join public.stores s on s.id=r.store_id join public.dealer_private_contacts c on c.user_id=r.dealer_user_id
 where r.id=p_record_id and s.owner_user_id=auth.uid() and r.status in ('confirmed','completed') and r.store_confirmed_at is not null and r.dealer_confirmed_at is not null and c.disclosure_consented_at is not null and c.disclosure_version='2026-10-07-contact-v1';
end;
$$;
revoke all on function public.get_matching_dealer_contacts(uuid) from public,anon;
grant execute on function public.get_matching_dealer_contacts(uuid) to authenticated;

-- Return aggregates only; another store's individual records stay private.
create function public.get_dealer_reliability(p_dealer_ids uuid[])
returns table(dealer_user_id uuid,total bigint,completed bigint,cancellations bigint,no_shows bigint)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.is_suspended() then raise exception '閲覧できません。'; end if;
 if p_dealer_ids is null or cardinality(p_dealer_ids)>500 then raise exception '対象を確認してください。'; end if;
 if not exists(select 1 from public.stores where owner_user_id=auth.uid()) and (cardinality(p_dealer_ids)<>1 or p_dealer_ids[1]<>auth.uid()) then raise exception '本人または店舗アカウントのみ閲覧できます。'; end if;
 return query select d.user_id,count(r.id),count(r.id) filter(where r.status='completed'),count(r.id) filter(where r.status in ('dealer_cancelled','no_show_verified')),count(r.id) filter(where r.status='no_show_verified')
 from public.dealer_profiles d left join public.dealer_matching_records r on r.dealer_user_id=d.user_id and r.store_confirmed_at is not null and r.dealer_confirmed_at is not null and r.outcome_at<=now() and ((r.status='completed' and r.work_end<=now()) or r.status='dealer_cancelled' or (r.status='no_show_verified' and r.work_start<=now() and r.verified_at<=now()))
 where d.user_id=any(p_dealer_ids) and (d.user_id=auth.uid() or (d.published and exists(select 1 from public.stores where owner_user_id=auth.uid()))) group by d.user_id;
end;
$$;
revoke all on function public.get_dealer_reliability(uuid[]) from public,anon;
grant execute on function public.get_dealer_reliability(uuid[]) to authenticated;
