alter table public.blog_entries add column if not exists image_alt text not null default '';
