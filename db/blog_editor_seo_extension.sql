-- BLOG editor / SEO extension. Existing articles keep working with safe defaults.
alter table public.blog_entries
 add column if not exists slug text,
 add column if not exists seo_title text not null default '',
 add column if not exists canonical_url text,
 add column if not exists search_index boolean not null default true,
 add column if not exists author_name text not null default '',
 add column if not exists author_profile text not null default '',
 add column if not exists published_at timestamptz,
 add column if not exists related_article_ids uuid[] not null default '{}'::uuid[],
 add column if not exists show_toc boolean not null default true,
 add column if not exists show_breadcrumbs boolean not null default true,
 add column if not exists include_in_sitemap boolean not null default true,
 add column if not exists reference_sources jsonb not null default '[]'::jsonb,
 add column if not exists image_rights text not null default '',
 add column if not exists visibility text not null default 'draft';

update public.blog_entries set visibility=case when active then 'published' else 'draft' end;
update public.blog_entries set published_at=created_at where published_at is null and active;
update public.blog_entries set slug=id::text where slug is null or btrim(slug)='';
alter table public.blog_entries alter column slug set not null;
alter table public.blog_entries add constraint blog_entries_visibility_check check (visibility in ('draft','published','private'));
alter table public.blog_entries add constraint blog_entries_slug_format_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
alter table public.blog_entries add constraint blog_entries_seo_title_check check (char_length(seo_title) <= 160);
alter table public.blog_entries add constraint blog_entries_author_name_check check (char_length(author_name) <= 120);
alter table public.blog_entries add constraint blog_entries_author_profile_check check (char_length(author_profile) <= 1000);
alter table public.blog_entries add constraint blog_entries_image_rights_check check (char_length(image_rights) <= 1000);
alter table public.blog_entries add constraint blog_entries_related_articles_check check (cardinality(related_article_ids) <= 12);
alter table public.blog_entries add constraint blog_entries_reference_sources_check check (jsonb_typeof(reference_sources)='array' and jsonb_array_length(reference_sources) <= 30);
create unique index if not exists blog_entries_slug_unique_idx on public.blog_entries(slug);
create index if not exists blog_entries_public_published_idx on public.blog_entries(published_at desc,id) where active;
