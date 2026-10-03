create table public.favorite_events(user_id uuid not null references auth.users(id) on delete cascade,event_id uuid not null references public.events(id) on delete cascade,created_at timestamptz not null default now(),primary key(user_id,event_id));
create index favorite_events_event_idx on public.favorite_events(event_id);
alter table public.favorite_events enable row level security;
grant select,insert,delete on public.favorite_events to authenticated;
create policy favorite_events_select on public.favorite_events for select to authenticated using((select auth.uid())=user_id);
create policy favorite_events_insert on public.favorite_events for insert to authenticated with check((select auth.uid())=user_id);
create policy favorite_events_delete on public.favorite_events for delete to authenticated using((select auth.uid())=user_id);
