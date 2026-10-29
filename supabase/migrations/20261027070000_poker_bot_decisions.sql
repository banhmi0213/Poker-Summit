-- GTO CPUs (owner 2026/10/27): count how each decision was made (preflop chart / flop solution / turn-river solver /
-- fallback and why), so the admin page shows how much of the play is real GTO.
create table if not exists poker_private.bot_decision_stats(source text primary key,decisions bigint not null default 0);
alter table poker_private.bot_decision_stats enable row level security;

create or replace function poker_private.bot_add_decisions(p_sources jsonb) returns void language sql security definer set search_path='' as $$
 insert into poker_private.bot_decision_stats as t(source,decisions)
 select left(k,80),v::bigint from jsonb_each_text(case when jsonb_typeof(p_sources)='object' then p_sources else '{}'::jsonb end) e(k,v) where v ~ '^[0-9]{1,9}$'
 on conflict(source) do update set decisions=t.decisions+excluded.decisions;
$$;
revoke all on function poker_private.bot_add_decisions(jsonb) from public,anon,authenticated;

create or replace function public.poker_bot_record(p_batch jsonb) returns void language plpgsql security definer set search_path='' as $$
declare keep int;n int;a int;
begin
 if jsonb_typeof(p_batch->'hands')<>'array' or jsonb_typeof(p_batch->'anomalies')<>'array' or jsonb_array_length(p_batch->'hands')>500 or jsonb_array_length(p_batch->'anomalies')>500 then raise exception 'Invalid bot batch';end if;
 insert into poker_private.bot_hands(table_no,history,actions,ms)
  select (h->>'table')::int,h->'history',(h->>'actions')::int,round((h->>'ms')::numeric)::int from jsonb_array_elements(p_batch->'hands') h;
 insert into poker_private.bot_anomalies(table_no,kind,detail,checkpoint)
  select (x->>'table')::int,left(x->>'kind',80),left(coalesce(x->>'detail',''),2000),x->'checkpoint' from jsonb_array_elements(p_batch->'anomalies') x;
 perform poker_private.bot_add_stats((select coalesce(jsonb_agg(h->'history'),'[]'::jsonb) from jsonb_array_elements(p_batch->'hands') h));
 perform poker_private.bot_add_decisions(p_batch->'stats'->'sources');
 n:=jsonb_array_length(p_batch->'hands');a:=jsonb_array_length(p_batch->'anomalies');
 insert into poker_private.bot_batches(hands,anomalies,avg_ms,max_ms,rss_mb)
  values(n,a,coalesce((p_batch->'stats'->>'avg_ms')::real,0),coalesce((p_batch->'stats'->>'max_ms')::real,0),coalesce((p_batch->'stats'->>'rss_mb')::int,0));
 -- Keep only the newest hands so the staging database does not fill up (the totals keep everything).
 select keep_hands into keep from poker_private.bot_settings where id=1;
 delete from poker_private.bot_hands where id<=(select max(id) from poker_private.bot_hands)-coalesce(keep,30000);
 delete from poker_private.bot_batches where created_at<now()-interval '30 days';
end;$$;
revoke all on function public.poker_bot_record(jsonb) from public,anon,authenticated;
grant execute on function public.poker_bot_record(jsonb) to service_role;

create or replace function public.poker_bot_stats() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Admin required'; end if;
 return jsonb_build_object(
  'asOf',now(),
  'settings',(select to_jsonb(s)-'id' from poker_private.bot_settings s where id=1),
  'stored',(select count(*) from poker_private.bot_hands),
  'positions',coalesce((select jsonb_agg(to_jsonb(p)) from poker_private.bot_position_stats p),'[]'::jsonb),
  'classes',coalesce((select jsonb_agg(to_jsonb(c)) from poker_private.bot_class_stats c),'[]'::jsonb),
  'decisions',coalesce((select jsonb_object_agg(source,decisions) from poker_private.bot_decision_stats),'{}'::jsonb),
  'speed',(select jsonb_build_object('hands',coalesce(sum(hands),0),'avgMs',round(avg(avg_ms)::numeric,1),'maxMs',round(max(max_ms)::numeric,1),'rssMb',max(rss_mb)) from poker_private.bot_batches where created_at>now()-interval '1 hour'),
  'anomalies',(select count(*) from poker_private.bot_anomalies),
  'recentAnomalies',coalesce((select jsonb_agg(jsonb_build_object('at',created_at,'kind',kind,'detail',left(detail,300)) order by id desc) from (select * from poker_private.bot_anomalies order by id desc limit 20) a),'[]'::jsonb));
end;$$;
revoke all on function public.poker_bot_stats() from public,anon;
grant execute on function public.poker_bot_stats() to authenticated;
