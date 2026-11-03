-- STAGING ONLY: scoped poker/auth foundation, not a portal schema clone.
-- Column definitions read from production catalogs; no production rows copied.
begin;
do $$ begin if exists(select 1 from pg_tables where schemaname='public') then raise exception 'Staging foundation requires empty public schema'; end if; end $$;
create table public.admin_users (
  user_id uuid not null,
  role text default 'admin'::text not null,
  created_at timestamp with time zone default now() not null,
  active boolean default true not null
);
create table public.audit_log (
  id uuid default gen_random_uuid() not null,
  actor_user_id uuid,
  actor_email text,
  action text not null,
  target_type text,
  target_id text,
  detail jsonb,
  created_at timestamp with time zone default now() not null
);
create table public.member_status (
  user_id uuid not null,
  suspended boolean default false not null,
  updated_at timestamp with time zone default now() not null
);
create table public.site_settings (
  id boolean default true not null,
  site_name text default 'Poker Summit'::text not null,
  contact_email text,
  maintenance_mode boolean default false not null,
  updated_at timestamp with time zone default now() not null,
  announcement text,
  listing_accept_new boolean default true not null,
  listing_require_review boolean default true not null,
  listing_instant_update boolean default false not null,
  listing_expiry_notify boolean default true not null,
  report_auto_hide_count text default '3件'::text not null,
  notify_email text,
  notify_new_listing boolean default true not null,
  notify_new_report boolean default true not null,
  notify_inquiry boolean default true not null,
  notify_banner_anomaly boolean default true not null,
  auto_notify_listing_result boolean default true not null,
  auto_notify_important boolean default true not null,
  notify_start_hour text default '9:00'::text not null,
  notify_end_hour text default '22:00'::text not null,
  maintenance_start timestamp with time zone,
  maintenance_end timestamp with time zone,
  maintenance_message text default 'ただいまシステムメンテナンスを実施しています。終了までしばらくお待ちください。'::text not null,
  maintenance_allowed_ips text,
  bank_transfer_info jsonb,
  invoice_registration_number text,
  transfer_due_days integer default 7 not null,
  prepay_discounts jsonb default '{"6": {"type": "percent", "value": 10}, "12": {"type": "free_months", "value": 2}}'::jsonb not null,
  card_payment_enabled boolean default true not null,
  prelaunch_mode boolean default false not null,
  prelaunch_message text,
  prelaunch_x_url text,
  price_lock_campaign_enabled boolean default false not null,
  price_lock_deadline timestamp with time zone default '2026-12-31 14:59:59+00'::timestamp with time zone not null
);
create table public.stores (
  id uuid default gen_random_uuid() not null,
  name text not null,
  category text,
  region text,
  pref text,
  city text,
  address text,
  tel text,
  hours text,
  description text,
  status text default 'pending'::text not null,
  owner_user_id uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  source_application_id uuid,
  line_url text,
  area_keywords text,
  is_recommended boolean default false not null,
  lat double precision,
  lng double precision,
  line_user_id text,
  logo_url text,
  logo_storage_path text,
  google_place_id text,
  nearest_station text,
  email text,
  x_url text,
  instagram_url text,
  banner_url text,
  banner_storage_path text,
  is_national_pickup boolean default false not null,
  google_match_status text,
  google_business_status text,
  google_match_note text,
  google_checked_at timestamp with time zone,
  geo_source text,
  google_hours_text text[],
  google_hours_periods jsonb,
  google_hours_fetched_at timestamp with time zone,
  notify_channel text default 'both'::text not null
);
alter table public.admin_users add primary key(user_id), add foreign key(user_id) references auth.users(id) on delete cascade;
alter table public.member_status add primary key(user_id), add foreign key(user_id) references auth.users(id) on delete cascade;
alter table public.stores add primary key(id), add foreign key(owner_user_id) references auth.users(id) on delete set null;
alter table public.site_settings add primary key(id), add check(id);
alter table public.audit_log add primary key(id), add foreign key(actor_user_id) references auth.users(id) on delete set null;
create index staging_store_owner on public.stores(owner_user_id);
create index staging_login_audit on public.audit_log(action,target_type,target_id,created_at);
-- Same own-user role/suspension semantics as production, using invoker RLS.
create function public.is_admin() returns boolean language sql stable security invoker set search_path='' as $$ select exists(select 1 from public.admin_users where user_id=(select auth.uid()) and active=true) $$;
create function public.is_suspended() returns boolean language sql stable security invoker set search_path='' as $$ select coalesce((select suspended from public.member_status where user_id=(select auth.uid())),false) $$;
alter table public.admin_users enable row level security;
alter table public.member_status enable row level security;
alter table public.stores enable row level security;
alter table public.audit_log enable row level security;
alter table public.site_settings enable row level security;
revoke all on public.admin_users,public.member_status,public.stores,public.audit_log,public.site_settings from public,anon,authenticated;
grant select on public.admin_users,public.member_status,public.stores to anon,authenticated;
grant select on public.site_settings to anon,authenticated;
grant all on public.admin_users,public.member_status,public.stores,public.audit_log,public.site_settings to service_role;
create policy staging_admin_self on public.admin_users for select to anon,authenticated using(user_id=(select auth.uid()));
create policy staging_status_self on public.member_status for select to anon,authenticated using(user_id=(select auth.uid()));
create policy staging_store_owner on public.stores for select to anon,authenticated using(owner_user_id=(select auth.uid()) or (select public.is_admin()));
create policy staging_settings_read on public.site_settings for select to anon,authenticated using(true);
revoke all on function public.is_admin(),public.is_suspended() from public;
grant execute on function public.is_admin(),public.is_suspended() to anon,authenticated,service_role;
-- New non-production defaults only. No email, bank details or production content.
insert into public.site_settings(id,site_name,card_payment_enabled) values(true,'Poker Summit 検証環境',false);
notify pgrst,'reload schema';
commit;
