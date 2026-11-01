-- スクレイピング監視(2026/10/30、オーナー指示：スクレイピングされたら速攻わかるように。遮断はせず記録して知らせる)。
-- middleware → /api/security/scrape-hit(service role) → record_scrape_hit。運営(is_admin)だけが一覧を読める。記録は90日で消える。
create table if not exists public.scrape_hits(
 id bigint generated always as identity primary key,
 created_at timestamptz not null default now(),
 ip text,ua text,path text,
 category text not null check(category in ('ai','tool','headless','no-ua','no-browser')),
 bot text
);
create index if not exists scrape_hits_created on public.scrape_hits(created_at desc);
create index if not exists scrape_hits_ip on public.scrape_hits(ip,created_at desc);
alter table public.scrape_hits enable row level security;
revoke all on public.scrape_hits from public,anon,authenticated;
grant select on public.scrape_hits to authenticated;
grant select,insert,delete on public.scrape_hits to service_role;
drop policy if exists scrape_hits_admin_read on public.scrape_hits;
create policy scrape_hits_admin_read on public.scrape_hits for select to authenticated using((select public.is_admin()));

create table if not exists public.scrape_alerts(key text primary key,last_sent timestamptz not null);
alter table public.scrape_alerts enable row level security;
revoke all on public.scrape_alerts from public,anon,authenticated;
grant select,insert,update on public.scrape_alerts to service_role;

create or replace function public.record_scrape_hit(p_ip text,p_ua text,p_path text,p_category text,p_bot text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n integer; k text; sent boolean;
begin
 insert into public.scrape_hits(ip,ua,path,category,bot) values(left(p_ip,64),left(p_ua,400),left(p_path,300),p_category,left(p_bot,80));
 select count(*) into n from public.scrape_hits where ip=left(p_ip,64) and created_at>now()-interval '10 minutes';
 if p_category in ('ai','tool','headless','no-ua') or n>=30 then
  k:=case when p_category='ai' then 'ai:'||coalesce(p_bot,'') else 'ip:'||coalesce(p_ip,'') end;
  insert into public.scrape_alerts(key,last_sent) values(k,now())
   on conflict(key) do update set last_sent=excluded.last_sent where public.scrape_alerts.last_sent<now()-interval '1 hour'
   returning true into sent;
 end if;
 if random()<0.01 then delete from public.scrape_hits where created_at<now()-interval '90 days'; end if;
 return jsonb_build_object('alert',coalesce(sent,false),'recent',n);
end;
$$;
revoke all on function public.record_scrape_hit(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_scrape_hit(text,text,text,text,text) to service_role;
