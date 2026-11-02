-- スクレイピングの遮断（オーナー指示 2026/11/02：スクレイピングきたらすぐ止めなあかん）。
-- ブラウザらしくないアクセスが同じIPから10分で30ページを超えたら、そのIPを7日間止める。
-- middleware は疑わしいアクセスのときだけ scrape_ip_blocked を聞く（普通のブラウザは問い合わせない）。
create table if not exists public.scrape_blocks(
 ip text primary key,
 reason text not null default '',
 created_at timestamptz not null default now(),
 expires_at timestamptz not null
);
alter table public.scrape_blocks enable row level security;
revoke all on public.scrape_blocks from public,anon,authenticated;
grant select on public.scrape_blocks to authenticated;
grant select,insert,update,delete on public.scrape_blocks to service_role;
drop policy if exists scrape_blocks_admin_read on public.scrape_blocks;
create policy scrape_blocks_admin_read on public.scrape_blocks for select to authenticated using((select public.is_admin()));

create or replace function public.scrape_ip_blocked(p_ip text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.scrape_blocks where ip=left(coalesce(p_ip,''),64) and expires_at>now());
$$;
revoke all on function public.scrape_ip_blocked(text) from public;
grant execute on function public.scrape_ip_blocked(text) to anon,authenticated,service_role;

create or replace function public.block_scrape_ip(p_ip text,p_reason text,p_days integer default 7) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(p_ip,'')='' then return false; end if;
 insert into public.scrape_blocks(ip,reason,expires_at) values(left(p_ip,64),left(coalesce(p_reason,''),200),now()+make_interval(days=>greatest(1,least(coalesce(p_days,7),365))))
  on conflict(ip) do update set reason=excluded.reason,expires_at=greatest(public.scrape_blocks.expires_at,excluded.expires_at);
 return true;
end;
$$;
revoke all on function public.block_scrape_ip(text,text,integer) from public,anon,authenticated;
grant execute on function public.block_scrape_ip(text,text,integer) to service_role;

-- 今日の FREEZEOUTResearch（店舗ページを10分で30ページ）。
select public.block_scrape_ip('106.72.34.194','FREEZEOUTResearch 店舗ページの自動収集',365);
