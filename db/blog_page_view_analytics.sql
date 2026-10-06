-- BLOG article page-view analytics.
-- Reuses the existing page_views table so the admin analytics screen can
-- aggregate store pages and BLOG articles from one event stream.
alter table public.page_views
  add column if not exists blog_entry_id uuid references public.blog_entries(id) on delete cascade;

create index if not exists page_views_blog_entry_created_idx
  on public.page_views(blog_entry_id, created_at desc)
  where blog_entry_id is not null;

-- Public article pages must be able to record anonymous page views.
grant insert on public.page_views to anon, authenticated;

drop policy if exists page_views_public_insert on public.page_views;
create policy page_views_public_insert on public.page_views
  for insert to anon, authenticated
  with check (
    (store_id is not null and blog_entry_id is null)
    or (blog_entry_id is not null and store_id is null)
  );

-- Only admins may read raw analytics events.
drop policy if exists page_views_admin_read on public.page_views;
create policy page_views_admin_read on public.page_views
  for select to authenticated
  using ((select public.is_admin()));
