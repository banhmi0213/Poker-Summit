-- STAGING ONLY. Catalog-compatible board tables for isolated panel verification.
-- No production rows are copied and this file must not be applied to production.
create table public.board_posts(
 id uuid primary key default gen_random_uuid(),author_user_id uuid references auth.users(id) on delete set null,
 author_name text not null default '匿名',title text not null,body text not null,status text not null default 'visible',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),category text,image_url text
);
create table public.board_replies(
 id uuid primary key default gen_random_uuid(),post_id uuid not null references public.board_posts(id) on delete cascade,
 author_user_id uuid references auth.users(id) on delete set null,author_name text not null default '匿名',body text not null,
 status text not null default 'visible',created_at timestamptz not null default now(),image_url text
);
create index staging_board_posts_created on public.board_posts(created_at desc);
create index staging_board_replies_thread on public.board_replies(post_id,created_at);
alter table public.board_posts enable row level security;
alter table public.board_replies enable row level security;
revoke all on public.board_posts,public.board_replies from public,anon,authenticated;
grant select,insert on public.board_posts,public.board_replies to authenticated;
create policy staging_board_posts_read on public.board_posts for select to authenticated using(status='visible' and not public.is_suspended());
create policy staging_board_posts_insert on public.board_posts for insert to authenticated with check(author_user_id=(select auth.uid()) and status='visible' and not public.is_suspended());
create policy staging_board_replies_read on public.board_replies for select to authenticated using(status='visible' and not public.is_suspended() and exists(select 1 from public.board_posts p where p.id=post_id and p.status='visible'));
create policy staging_board_replies_insert on public.board_replies for insert to authenticated with check(author_user_id=(select auth.uid()) and status='visible' and not public.is_suspended() and exists(select 1 from public.board_posts p where p.id=post_id and p.status='visible'));
