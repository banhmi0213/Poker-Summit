-- Optional per-article X post; existing articles stay unchanged.
alter table public.blog_entries
 add column if not exists x_post_url text not null default '';
