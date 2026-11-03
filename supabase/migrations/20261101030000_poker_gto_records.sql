-- GTO records (owner 2026/11/1「プレイヤーがプレイした全部から収集」「あかんとこが溜まっていく」).
-- One row per graded decision from every place a member plays (ring, tournaments, the CPU practice table, GTOと対戦,
-- プリフロップ連打, quizzes), and the practice-table hands themselves. Read and written only through the functions below
-- (security definer, the caller's own rows only); no direct table access. Rows go away with the member
-- (on delete cascade; the anonymising withdrawal deletes them explicitly, see private.withdraw_member).
create table if not exists public.poker_gto_decisions(
 id bigint generated always as identity primary key,
 member_id uuid not null references auth.users(id) on delete cascade,
 source text not null check(source in ('ring','tournament','practice','trainer','drill','quiz','daily')),
 ref text check(ref is null or length(ref) between 1 and 80),
 step smallint not null default 0 check(step between 0 and 999),
 played_at timestamptz not null default now(),
 seats smallint not null check(seats between 2 and 10),
 stack real not null check(stack>=0 and stack<=100000),
 position text not null check(length(position) between 1 and 8),
 street text not null check(street in ('preflop','flop','turn','river')),
 spot text not null check(spot ~ '^[A-Za-z0-9:+_-]{3,60}$'),
 hand text not null check(hand ~ '^[2-9TJQKA]{2}[so]?$|^$'),
 board text not null default '' check(board ~ '^([2-9TJQKA][cdhs]){0,5}$'),
 action text not null check(length(action) between 1 and 40),
 freq real check(freq is null or (freq>=0 and freq<=1)),
 ev_loss real check(ev_loss is null or (ev_loss>=0 and ev_loss<=1000)),
 level text check(level is null or level in ('best','correct','inaccurate','mistake','blunder'))
);
create unique index if not exists poker_gto_decisions_once on public.poker_gto_decisions(member_id,source,ref,step) where ref is not null;
create index if not exists poker_gto_decisions_member_time on public.poker_gto_decisions(member_id,played_at desc);
create index if not exists poker_gto_decisions_member_spot on public.poker_gto_decisions(member_id,spot,played_at desc);
alter table public.poker_gto_decisions enable row level security;
revoke all on public.poker_gto_decisions from public,anon,authenticated;

create table if not exists public.poker_gto_practice_hands(
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references auth.users(id) on delete cascade,
 played_at timestamptz not null default now(),
 seats smallint not null check(seats between 2 and 10),
 net real not null check(net between -100000 and 100000),
 hand jsonb not null check(jsonb_typeof(hand)='object' and length(hand::text)<=40000)
);
create index if not exists poker_gto_practice_hands_member_time on public.poker_gto_practice_hands(member_id,played_at desc);
alter table public.poker_gto_practice_hands enable row level security;
revoke all on public.poker_gto_practice_hands from public,anon,authenticated;

create or replace function poker_private.gto_member() returns uuid language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or public.is_suspended() is distinct from false then raise exception 'Login required'; end if;
 return auth.uid();
end; $$;
revoke all on function poker_private.gto_member() from public,anon,authenticated;

-- Save graded decisions (at most 200 per call, 5,000 per day). Malformed rows are skipped, repeats (same ref and step)
-- are kept once. Returns how many rows were added.
create or replace function public.poker_gto_record(p_rows jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare who uuid:=poker_private.gto_member();today_n integer;added integer;
begin
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>200 then raise exception 'Invalid rows'; end if;
 select count(*) into today_n from public.poker_gto_decisions where member_id=who and played_at>=now()-interval '1 day';
 if today_n+jsonb_array_length(p_rows)>5000 then raise exception 'Too many records today'; end if;
 insert into public.poker_gto_decisions(member_id,source,ref,step,seats,stack,position,street,spot,hand,board,action,freq,ev_loss,level)
 select who,x.source,nullif(x.ref,''),coalesce(x.step,0),x.seats,x.stack,x.position,x.street,x.spot,coalesce(x.hand,''),coalesce(x.board,''),x.action,x.freq,x."evLoss",x.level
 from jsonb_to_recordset(p_rows) as x(source text,ref text,step integer,seats integer,stack real,position text,street text,spot text,hand text,board text,action text,freq real,"evLoss" real,level text)
 where x.source in ('ring','tournament','practice','trainer','drill','quiz','daily')
   and (x.ref is null or length(x.ref) between 1 and 80) and coalesce(x.step,0) between 0 and 999
   and x.seats between 2 and 10 and x.stack between 0 and 100000
   and length(coalesce(x.position,'')) between 1 and 8 and x.street in ('preflop','flop','turn','river')
   and coalesce(x.spot,'') ~ '^[A-Za-z0-9:+_-]{3,60}$' and coalesce(x.hand,'') ~ '^[2-9TJQKA]{2}[so]?$|^$'
   and coalesce(x.board,'') ~ '^([2-9TJQKA][cdhs]){0,5}$' and length(coalesce(x.action,'')) between 1 and 40
   and (x.freq is null or (x.freq>=0 and x.freq<=1)) and (x."evLoss" is null or (x."evLoss">=0 and x."evLoss"<=1000))
   and (x.level is null or x.level in ('best','correct','inaccurate','mistake','blunder'))
 on conflict (member_id,source,ref,step) where ref is not null do nothing;
 get diagnostics added=row_count;
 return added;
end; $$;
revoke all on function public.poker_gto_record(jsonb) from public,anon;
grant execute on function public.poker_gto_record(jsonb) to authenticated;

-- Which of these hands (or questions) already have records, so the browser does not judge them again.
create or replace function public.poker_gto_recorded_refs(p_source text,p_refs text[]) returns text[] language plpgsql stable security definer set search_path='' as $$
declare who uuid:=poker_private.gto_member();
begin
 if p_refs is null or cardinality(p_refs)>500 then raise exception 'Invalid refs'; end if;
 return coalesce((select array_agg(distinct d.ref) from public.poker_gto_decisions d where d.member_id=who and d.source=p_source and d.ref=any(p_refs)),'{}');
end; $$;
revoke all on function public.poker_gto_recorded_refs(text,text[]) from public,anon;
grant execute on function public.poker_gto_recorded_refs(text,text[]) to authenticated;

-- Save one practice-table hand (at most 1,000 a day). Returns its id; its decisions are sent with ref = that id.
create or replace function public.poker_gto_practice_hand_save(p_seats integer,p_net real,p_hand jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare who uuid:=poker_private.gto_member();n integer;out_id uuid;
begin
 if p_hand is null or jsonb_typeof(p_hand)<>'object' or length(p_hand::text)>40000 or p_seats is null or p_seats not between 2 and 10
    or p_net is null or p_net not between -100000 and 100000 then raise exception 'Invalid hand'; end if;
 select count(*) into n from public.poker_gto_practice_hands where member_id=who and played_at>=now()-interval '1 day';
 if n>=1000 then raise exception 'Too many hands today'; end if;
 insert into public.poker_gto_practice_hands(member_id,seats,net,hand) values(who,p_seats,p_net,p_hand) returning id into out_id;
 return out_id;
end; $$;
revoke all on function public.poker_gto_practice_hand_save(integer,real,jsonb) from public,anon;
grant execute on function public.poker_gto_practice_hand_save(integer,real,jsonb) to authenticated;

create or replace function public.poker_gto_practice_hands(p_before timestamptz default null,p_limit integer default 20) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=poker_private.gto_member();
begin
 return coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'playedAt',h.played_at,'seats',h.seats,'net',h.net,'hand',h.hand) order by h.played_at desc)
  from (select * from public.poker_gto_practice_hands where member_id=who and (p_before is null or played_at<p_before)
        order by played_at desc limit greatest(1,least(coalesce(p_limit,20),50))) h),'[]'::jsonb);
end; $$;
revoke all on function public.poker_gto_practice_hands(timestamptz,integer) from public,anon;
grant execute on function public.poker_gto_practice_hands(timestamptz,integer) to authenticated;

-- あかんとこ一覧: the member's decisions grouped by spot over the last p_days days (sources / seats optional filters),
-- worst first (EV lost, then mistakes), with the latest misses of each spot.
create or replace function public.poker_gto_weak_spots(p_days integer default 90,p_sources text[] default null,p_seats integer default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=poker_private.gto_member();since timestamptz:=now()-make_interval(days=>greatest(1,least(coalesce(p_days,90),3650)));
begin
 return (with d as (
   select * from public.poker_gto_decisions where member_id=who and played_at>=since
    and (p_sources is null or source=any(p_sources)) and (p_seats is null or seats=p_seats)),
  g as (
   select spot,count(*) n,count(*) filter(where level in ('mistake','blunder')) misses,count(*) filter(where level='inaccurate') near,
    count(*) filter(where level in ('best','correct')) good,coalesce(sum(ev_loss),0) ev_loss,count(ev_loss) ev_n,max(played_at) last
   from d where level is not null group by spot),
  top as (select * from g order by ev_loss desc,misses desc,n desc limit 40)
  select jsonb_build_object(
   'days',greatest(1,least(coalesce(p_days,90),3650)),
   'total',(select jsonb_build_object('decisions',count(*),'graded',count(level),'misses',count(*) filter(where level in ('mistake','blunder')),'evLoss',coalesce(sum(ev_loss),0),'evN',count(ev_loss)) from d),
   'bySource',coalesce((select jsonb_object_agg(source,n) from (select source,count(*) n from d group by source) s),'{}'::jsonb),
   'spots',coalesce((select jsonb_agg(jsonb_build_object('spot',t.spot,'n',t.n,'misses',t.misses,'close',t.near,'good',t.good,'evLoss',t.ev_loss,'evN',t.ev_n,'last',t.last,
     'examples',coalesce((select jsonb_agg(jsonb_build_object('source',e.source,'hand',e.hand,'board',e.board,'action',e.action,'freq',e.freq,'evLoss',e.ev_loss,'level',e.level,'at',e.played_at,'ref',e.ref) order by e.played_at desc)
       from (select * from d where d.spot=t.spot and d.level in ('mistake','blunder','inaccurate') order by played_at desc limit 5) e),'[]'::jsonb))
     order by t.ev_loss desc,t.misses desc,t.n desc) from top t),'[]'::jsonb)));
end; $$;
revoke all on function public.poker_gto_weak_spots(integer,text[],integer) from public,anon;
grant execute on function public.poker_gto_weak_spots(integer,text[],integer) to authenticated;
