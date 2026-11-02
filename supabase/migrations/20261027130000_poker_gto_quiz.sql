-- GTO quiz results per member (owner 2026/10/27: 「クイズの成績：会員ごとに保存する」).
-- Totals per question category only (no per-answer log): answered, points (0〜100 per answer), correct (80+ points).
-- Categories: preflop-<chart kind> (open, vsopen, vs3bet, vs4bet, vs5bet, overcall) and flop-<spot id>.
create table if not exists poker_private.gto_quiz_stats(
 member_id uuid not null,
 category text not null check(category ~ '^(preflop|flop)-[a-z0-9-]{1,30}$'),
 answered integer not null default 0 check(answered>=0),
 points bigint not null default 0 check(points>=0 and points<=answered::bigint*100),
 correct integer not null default 0 check(correct>=0 and correct<=answered),
 updated_at timestamptz not null default now(),
 primary key(member_id,category)
);
alter table poker_private.gto_quiz_stats enable row level security;
revoke all on poker_private.gto_quiz_stats from public,anon,authenticated;
-- Daily answer counts, only to stop scripted flooding (at most 1,000 answers a day, Japan time).
create table if not exists poker_private.gto_quiz_daily(
 member_id uuid not null,
 day date not null,
 answered integer not null default 0,
 primary key(member_id,day)
);
alter table poker_private.gto_quiz_daily enable row level security;
revoke all on poker_private.gto_quiz_daily from public,anon,authenticated;

create or replace function poker_private.gto_quiz_summary(p_member uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
  'answered',coalesce(sum(s.answered),0),'points',coalesce(sum(s.points),0),'correct',coalesce(sum(s.correct),0),
  'categories',coalesce(jsonb_agg(jsonb_build_object('category',s.category,'answered',s.answered,'points',s.points,'correct',s.correct) order by s.category) filter(where s.category is not null),'[]'::jsonb))
 from poker_private.gto_quiz_stats s where s.member_id=p_member;
$$;
revoke all on function poker_private.gto_quiz_summary(uuid) from public,anon,authenticated;

create or replace function public.poker_gto_quiz_record(p_category text,p_points integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();today date:=(now() at time zone 'Asia/Tokyo')::date;n integer;
begin
 if who is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or public.is_suspended() is distinct from false then raise exception 'Login required'; end if;
 if p_category is null or p_category !~ '^(preflop|flop)-[a-z0-9-]{1,30}$' then raise exception 'Invalid category'; end if;
 if p_points is null or p_points<0 or p_points>100 then raise exception 'Invalid points'; end if;
 insert into poker_private.gto_quiz_daily(member_id,day,answered) values(who,today,1)
 on conflict(member_id,day) do update set answered=poker_private.gto_quiz_daily.answered+1 returning answered into n;
 if n>1000 then raise exception 'Too many answers today'; end if;
 if not exists(select 1 from poker_private.gto_quiz_stats where member_id=who and category=p_category)
    and (select count(*) from poker_private.gto_quiz_stats where member_id=who)>=40 then raise exception 'Too many categories'; end if;
 insert into poker_private.gto_quiz_stats(member_id,category,answered,points,correct) values(who,p_category,1,p_points,case when p_points>=80 then 1 else 0 end)
 on conflict(member_id,category) do update set answered=poker_private.gto_quiz_stats.answered+1,points=poker_private.gto_quiz_stats.points+excluded.points,
  correct=poker_private.gto_quiz_stats.correct+excluded.correct,updated_at=now();
 return poker_private.gto_quiz_summary(who);
end; $$;
revoke all on function public.poker_gto_quiz_record(text,integer) from public,anon;
grant execute on function public.poker_gto_quiz_record(text,integer) to authenticated;

create or replace function public.poker_gto_quiz_stats() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if who is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Login required'; end if;
 return poker_private.gto_quiz_summary(who);
end; $$;
revoke all on function public.poker_gto_quiz_stats() from public,anon;
grant execute on function public.poker_gto_quiz_stats() to authenticated;

-- 「成績をリセット」: the member clears their own quiz results.
create or replace function public.poker_gto_quiz_reset() returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if who is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Login required'; end if;
 delete from poker_private.gto_quiz_stats where member_id=who;
 return poker_private.gto_quiz_summary(who);
end; $$;
revoke all on function public.poker_gto_quiz_reset() from public,anon;
grant execute on function public.poker_gto_quiz_reset() to authenticated;
