-- 広告のリンク(目印付き)から来た会員を記録する(2026/10/21)。
-- ディーラー登録広告で「何人が会員登録し、何人がディーラー登録したか」を数えるため。運営(サービスロール)だけが読み書きする。
create table if not exists public.ad_attributions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  source text not null,
  via text not null check (via in ('signup', 'visit')),
  created_at timestamptz not null default now()
);
alter table public.ad_attributions enable row level security;
revoke all on public.ad_attributions from anon, authenticated;
notify pgrst, 'reload schema';
