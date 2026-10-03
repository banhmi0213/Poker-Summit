create table public.blog_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  summary text not null default '' check (char_length(summary) <= 600),
  category text not null default '店舗紹介' check (category in ('店舗紹介','大会レポート','初心者ガイド')),
  article_url text not null check (article_url ~ '^https?://[^[:space:]]+$'),
  image_url text not null,
  image_path text not null,
  featured boolean not null default false,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index blog_entries_public_date_idx on public.blog_entries(created_at desc,id) where active;
alter table public.blog_entries enable row level security;
grant select on public.blog_entries to anon;
grant select,insert,update on public.blog_entries to authenticated;
create policy blog_entries_public_read on public.blog_entries for select to anon,authenticated using (active);
create policy blog_entries_admin_read on public.blog_entries for select to authenticated using ((select public.is_admin()));
create policy blog_entries_admin_insert on public.blog_entries for insert to authenticated with check ((select public.is_admin()));
create policy blog_entries_admin_update on public.blog_entries for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('blog-images','blog-images',true,3145728,array['image/jpeg','image/png','image/webp']);
create policy blog_images_admin_manage on storage.objects for all to authenticated
using (bucket_id='blog-images' and (select public.is_admin()))
with check (bucket_id='blog-images' and (select public.is_admin()));
