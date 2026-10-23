-- 自動で集めたポーカーニュースの記録(2026/10/23)。一度記事(下書き)にした元記事のURLを残し、同じニュースを二度書かない。
create table if not exists public.news_auto_items (
  id uuid primary key default gen_random_uuid(),
  source_url text not null unique,
  title text,
  blog_entry_id uuid references public.blog_entries(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.news_auto_items enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'news_auto_items' and policyname = 'news_auto_items_admin_all') then
    create policy news_auto_items_admin_all on public.news_auto_items for all using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
