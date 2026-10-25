-- Optional job details and opt-in in-mypage new job alerts.
alter table public.jobs add column if not exists experience_level text check (experience_level in ('any','beginner','experienced'));
alter table public.jobs add column if not exists training_details text;
alter table public.jobs add column if not exists transportation_details text;
alter table public.jobs add column if not exists application_deadline date;
create index if not exists jobs_alert_lookup_idx on public.jobs(status,posted_at);
create table if not exists public.job_alert_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false,
 pref text,
 experience_level text not null default 'any' check (experience_level in ('any','beginner','experienced')),
 subscribed_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.job_alert_preferences enable row level security;
drop policy if exists job_alert_own_select on public.job_alert_preferences;
create policy job_alert_own_select on public.job_alert_preferences for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists job_alert_own_insert on public.job_alert_preferences;
create policy job_alert_own_insert on public.job_alert_preferences for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists job_alert_own_update on public.job_alert_preferences;
create policy job_alert_own_update on public.job_alert_preferences for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

grant select,insert,update on public.job_alert_preferences to authenticated;
