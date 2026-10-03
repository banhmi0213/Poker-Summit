-- Existing external-URL articles remain unchanged; new articles may use site content.
alter table public.blog_entries
 add column content_mode text not null default 'external' check (content_mode in ('internal','external')),
 add column body jsonb not null default '[]'::jsonb check (jsonb_typeof(body) = 'array' and jsonb_array_length(body) <= 100),
 add column related_store_ids uuid[] not null default '{}'::uuid[] check (cardinality(related_store_ids) <= 20);
alter table public.blog_entries alter column article_url drop not null;
alter table public.blog_entries add constraint blog_entries_mode_url_check check (content_mode = 'internal' or article_url is not null);
-- Existing active/admin RLS policies cover these columns as well.
