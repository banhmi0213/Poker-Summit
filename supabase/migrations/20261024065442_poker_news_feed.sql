create table public.poker_news (
 id uuid primary key default gen_random_uuid(),
 import_key text not null unique default gen_random_uuid()::text,
 title text not null check(char_length(title) between 1 and 200),
 summary text not null check(char_length(summary) between 1 and 600),
 category text not null check(category in ('国内大会','海外大会','大会結果','業界情報','配信・アプリ','未確認・参考')),
 source_url text not null check(source_url ~ '^https?://'),
 source_label text not null default '情報元を見る' check(char_length(source_label) between 1 and 60),
 related_blog_id uuid references public.blog_entries(id) on delete set null,
 news_date date not null default (now() at time zone 'Asia/Tokyo')::date,
 active boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.poker_news enable row level security;
grant select on public.poker_news to anon;
grant select,insert,update,delete on public.poker_news to authenticated;
grant all on public.poker_news to service_role;
create policy poker_news_public_read on public.poker_news for select to anon,authenticated using(active);
create policy poker_news_admin_all on public.poker_news for all to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create index poker_news_public_date on public.poker_news(news_date desc,created_at desc,id desc) where active;
create index poker_news_related_blog on public.poker_news(related_blog_id);
