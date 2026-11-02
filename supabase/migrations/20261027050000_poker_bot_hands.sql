-- Staging CPU hands (owner request 2026/10/27): bots play nonstop on the game server to collect hands and
-- to catch engine bugs / watch load. Off by default; switched with poker_private.bot_settings.enabled.
-- The server code refuses to run against the production project even if this table exists there.
create table if not exists poker_private.bot_settings(
 id int primary key default 1 check (id=1),
 enabled boolean not null default false,
 tables int not null default 1 check (tables between 1 and 6),
 pause_ms int not null default 1000 check (pause_ms between 0 and 60000),
 keep_hands int not null default 30000 check (keep_hands between 1000 and 500000),
 updated_at timestamptz not null default now());
insert into poker_private.bot_settings(id) values (1) on conflict (id) do nothing;
create table if not exists poker_private.bot_hands(
 id bigserial primary key, created_at timestamptz not null default now(), table_no int not null,
 history jsonb not null, actions int not null, ms int not null);
create table if not exists poker_private.bot_anomalies(
 id bigserial primary key, created_at timestamptz not null default now(), table_no int not null,
 kind text not null, detail text not null, checkpoint jsonb);
create table if not exists poker_private.bot_batches(
 id bigserial primary key, created_at timestamptz not null default now(), hands int not null, anomalies int not null,
 avg_ms real not null, max_ms real not null, rss_mb int not null);
alter table poker_private.bot_settings enable row level security;
alter table poker_private.bot_hands enable row level security;
alter table poker_private.bot_anomalies enable row level security;
alter table poker_private.bot_batches enable row level security;

create or replace function public.poker_bot_settings() returns jsonb language sql security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('enabled',enabled,'tables',tables,'pause_ms',pause_ms) from poker_private.bot_settings where id=1),'{"enabled":false}'::jsonb);
$$;

create or replace function public.poker_bot_record(p_batch jsonb) returns void language plpgsql security definer set search_path='' as $$
declare keep int;n int;a int;
begin
 if jsonb_typeof(p_batch->'hands')<>'array' or jsonb_typeof(p_batch->'anomalies')<>'array' or jsonb_array_length(p_batch->'hands')>500 or jsonb_array_length(p_batch->'anomalies')>500 then raise exception 'Invalid bot batch';end if;
 insert into poker_private.bot_hands(table_no,history,actions,ms)
  select (h->>'table')::int,h->'history',(h->>'actions')::int,round((h->>'ms')::numeric)::int from jsonb_array_elements(p_batch->'hands') h;
 insert into poker_private.bot_anomalies(table_no,kind,detail,checkpoint)
  select (x->>'table')::int,left(x->>'kind',80),left(coalesce(x->>'detail',''),2000),x->'checkpoint' from jsonb_array_elements(p_batch->'anomalies') x;
 n:=jsonb_array_length(p_batch->'hands');a:=jsonb_array_length(p_batch->'anomalies');
 insert into poker_private.bot_batches(hands,anomalies,avg_ms,max_ms,rss_mb)
  values(n,a,coalesce((p_batch->'stats'->>'avg_ms')::real,0),coalesce((p_batch->'stats'->>'max_ms')::real,0),coalesce((p_batch->'stats'->>'rss_mb')::int,0));
 -- Keep only the newest hands so the staging database does not fill up.
 select keep_hands into keep from poker_private.bot_settings where id=1;
 delete from poker_private.bot_hands where id<=(select max(id) from poker_private.bot_hands)-coalesce(keep,30000);
 delete from poker_private.bot_batches where created_at<now()-interval '30 days';
end;$$;

revoke all on function public.poker_bot_settings() from public,anon,authenticated;
revoke all on function public.poker_bot_record(jsonb) from public,anon,authenticated;
grant execute on function public.poker_bot_settings() to service_role;
grant execute on function public.poker_bot_record(jsonb) to service_role;
