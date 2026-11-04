-- Additive only. Apply to the staging DB first. Production owner must run this
-- BEFORE merging the staging -> main release PR. Existing tables/data are untouched.
create table public.gto_usage_events (
  id uuid primary key,
  created_at timestamptz not null default now(),
  visitor_id uuid not null,
  member_id uuid,
  tool text not null check (tool in ('preflop','flop','hand','drill','ranges','weak','curve','quiz','calculator','lesson')),
  action text not null check (action in ('open','start','answer')),
  device text not null check (device in ('mobile','pc'))
);
create index gto_usage_events_created_at_idx on public.gto_usage_events (created_at);
create index gto_usage_events_tool_created_at_idx on public.gto_usage_events (tool,created_at);
alter table public.gto_usage_events enable row level security;
-- No browser direct access, including authenticated members and admins.
-- Server routes verify admin_users before loading any aggregate via service_role.
revoke all on table public.gto_usage_events from public, anon, authenticated;
grant select, insert on table public.gto_usage_events to service_role;
comment on table public.gto_usage_events is 'GTO操作の匿名利用集計。氏名・メール・IP・回答内容は保存しない。運営閲覧は認可済みサーバー経由のみ。';
