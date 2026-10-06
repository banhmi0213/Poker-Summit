-- Keep the database constraints in sync with the BLOG admin UI.
alter table public.blog_entries drop constraint if exists blog_entries_category_check;
alter table public.blog_entries add constraint blog_entries_category_check
  check (category in (
    '初心者ガイド',
    'ポーカー用語集',
    'ルール・遊び方',
    'ハンド・役',
    '戦略の基礎',
    '実践ノウハウ',
    'トーナメント',
    '大会レポート',
    '店舗紹介',
    'ポーカーニュース',
    'イベント・キャンペーン',
    'コラム・読み物'
  ));

-- Admins may permanently delete BLOG entries after the application-level
-- title confirmation. Without this policy RLS silently blocks DELETE.
drop policy if exists blog_entries_admin_delete on public.blog_entries;
create policy blog_entries_admin_delete on public.blog_entries
  for delete to authenticated
  using ((select public.is_admin()));
