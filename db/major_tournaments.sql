create table public.major_tournaments (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(title) between 1 and 160),
 scope text not null check (scope in ('国内','海外')),
 location text not null default '' check (char_length(location)<=200),
 venue text not null default '' check (char_length(venue)<=300),
 start_date date, end_date date,
 description text not null default '' check (char_length(description)<=10000),
 schedule text not null default '' check (char_length(schedule)<=20000),
 official_url text not null default '' check (char_length(official_url)<=2048),
 active boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (end_date is null or start_date is null or end_date>=start_date)
);
create index major_tournaments_public_date_idx on public.major_tournaments(start_date,id) where active;
alter table public.major_tournaments enable row level security;
revoke all on public.major_tournaments from anon,authenticated;
grant select on public.major_tournaments to anon;
grant select,insert,update on public.major_tournaments to authenticated;
create policy major_tournaments_public_read on public.major_tournaments for select to anon,authenticated using (active);
create policy major_tournaments_admin_read on public.major_tournaments for select to authenticated using ((select public.is_admin()));
create policy major_tournaments_admin_insert on public.major_tournaments for insert to authenticated with check ((select public.is_admin()));
create policy major_tournaments_admin_update on public.major_tournaments for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
