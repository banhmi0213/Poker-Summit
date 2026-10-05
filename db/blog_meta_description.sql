alter table public.blog_entries add column if not exists meta_description text not null default '';
