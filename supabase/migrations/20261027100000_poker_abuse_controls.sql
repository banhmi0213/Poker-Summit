-- Anti-abuse for the public ring release (owner 2026/10/27: 「荒らしもくるやろから…荒らし対策もしっかりな」).
-- Ring play already requires a confirmed e-mail, a non-anonymous, non-banned, non-suspended account (ring_member_eligible).
-- This adds:
--  1) Throttles in the chip ledger itself: at most 30 seat joins per hour and 3 free refills per day (Japan time).
--  2) Poker-only bans set by operators (poker_private.poker_bans), checked wherever ring eligibility is checked.
--  3) Reports from players (通報) addressed by table + seat, with an operator list.

-- 1) Throttles ------------------------------------------------------------------------------------------------
create or replace function poker_private.ring_ledger_throttle() returns trigger language plpgsql set search_path='' as $$
begin
 if new.kind='reserve' and (select count(*) from poker_private.ring_chip_ledger l where l.member_id=new.member_id and l.kind='reserve' and l.created_at>now()-interval '1 hour')>=30 then
  raise exception 'Too many seat changes' using hint='着席の回数が多すぎます。しばらく時間をおいてください。';
 end if;
 if new.kind='refill' and (select count(*) from poker_private.ring_chip_ledger l where l.member_id=new.member_id and l.kind='refill'
    and l.created_at>=(date_trunc('day',now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo'))>=3 then
  raise exception 'Refill limit reached' using hint='chipの補充は1日3回までです。';
 end if;
 return new;
end; $$;
do $$ begin
 if not exists(select 1 from pg_trigger where tgname='ring_ledger_throttle' and tgrelid='poker_private.ring_chip_ledger'::regclass) then
  create trigger ring_ledger_throttle before insert on poker_private.ring_chip_ledger for each row execute function poker_private.ring_ledger_throttle();
 end if;
end $$;

-- 2) Poker-only bans --------------------------------------------------------------------------------------------
create table if not exists poker_private.poker_bans(
 member_id uuid primary key,
 until timestamptz,                 -- null = until lifted
 reason text not null default '' check(length(reason)<=500),
 created_by uuid,
 created_at timestamptz not null default now()
);
alter table poker_private.poker_bans enable row level security;
revoke all on poker_private.poker_bans from public,anon,authenticated;

create or replace function poker_private.ring_member_eligible(p_member uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=p_member and u.email_confirmed_at is not null and u.deleted_at is null and not coalesce(u.is_anonymous,false) and u.email is not null and u.email not ilike '%@login.poker-summit.jp' and (u.banned_until is null or u.banned_until<now()) and not exists(select 1 from public.member_status s where s.user_id=u.id and s.suspended))
  and not exists(select 1 from poker_private.poker_bans b where b.member_id=p_member and (b.until is null or b.until>now()));
$$;
revoke all on function poker_private.ring_member_eligible(uuid) from public,anon,authenticated,service_role;

-- 3) Reports --------------------------------------------------------------------------------------------------
create table if not exists poker_private.member_reports(
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null,
 target_id uuid not null,
 table_id uuid,
 reason text not null check(reason in('abuse','name','griefing','cheating','other')),
 note text not null default '' check(length(note)<=500),
 status text not null default 'open' check(status in('open','done')),
 created_at timestamptz not null default now(),
 check(reporter_id<>target_id)
);
create index if not exists member_reports_target on poker_private.member_reports(target_id,created_at desc);
create index if not exists member_reports_reporter on poker_private.member_reports(reporter_id,created_at desc);
alter table poker_private.member_reports enable row level security;
revoke all on poker_private.member_reports from public,anon,authenticated;

create or replace function poker_display.ring_member_report(p_table uuid,p_seat integer,p_reason text,p_note text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();target uuid;clean text:=left(btrim(coalesce(p_note,'')),500);
begin
 if who is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or public.is_suspended() is distinct from false then raise exception 'Not authorized'; end if;
 if p_seat is null or p_seat not between 1 and 6 then raise exception 'Invalid seat'; end if;
 if p_reason is null or p_reason not in('abuse','name','griefing','cheating','other') then raise exception 'Invalid reason'; end if;
 target:=poker_display.ring_seat_member(p_table,p_seat);
 if target is null then raise exception 'Seat is empty'; end if;
 if target=who then raise exception 'Cannot report yourself'; end if;
 -- One report per reporter and player per day; at most 20 reports a day per reporter.
 if exists(select 1 from poker_private.member_reports r where r.reporter_id=who and r.target_id=target and r.created_at>now()-interval '1 day') then return jsonb_build_object('ok',true,'duplicate',true); end if;
 if (select count(*) from poker_private.member_reports r where r.reporter_id=who and r.created_at>now()-interval '1 day')>=20 then raise exception 'Too many reports'; end if;
 insert into poker_private.member_reports(reporter_id,target_id,table_id,reason,note) values(who,target,p_table,p_reason,clean);
 return jsonb_build_object('ok',true,'duplicate',false);
end; $$;
revoke all on function poker_display.ring_member_report(uuid,integer,text,text) from public,anon;
grant execute on function poker_display.ring_member_report(uuid,integer,text,text) to authenticated;
create or replace function public.poker_ring_member_report(p_table uuid,p_seat integer,p_reason text,p_note text)
returns jsonb language sql set search_path='' as $$select poker_display.ring_member_report(p_table,p_seat,p_reason,p_note);$$;
revoke all on function public.poker_ring_member_report(uuid,integer,text,text) from public,anon;
grant execute on function public.poker_ring_member_report(uuid,integer,text,text) to authenticated;

-- Operators: reported players with counts and recent notes, plus ban / lift.
create or replace function public.poker_admin_reports() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.is_admin(),false) then raise exception 'Admin required'; end if;
 return coalesce((select jsonb_agg(x order by (x->>'open')::int desc,(x->>'last')::timestamptz desc) from (
  select jsonb_build_object('memberId',r.target_id,
   'name',coalesce(nullif(p.display_name,''),nullif(u.raw_user_meta_data->>'display_name',''),'会員'),
   'reports',count(*),'open',count(*) filter(where r.status='open'),'reporters',count(distinct r.reporter_id),'last',max(r.created_at),
   'reasons',(select jsonb_object_agg(z.reason,z.n) from (select q.reason,count(*) n from poker_private.member_reports q where q.target_id=r.target_id group by q.reason) z),
   'notes',(select coalesce(jsonb_agg(jsonb_build_object('reason',q.reason,'note',q.note,'at',q.created_at) order by q.created_at desc),'[]'::jsonb) from (select * from poker_private.member_reports q where q.target_id=r.target_id order by q.created_at desc limit 10) q),
   'ban',(select jsonb_build_object('until',b.until,'reason',b.reason) from poker_private.poker_bans b where b.member_id=r.target_id and (b.until is null or b.until>now()))) x
  from poker_private.member_reports r
  left join public.profiles p on p.user_id=r.target_id left join auth.users u on u.id=r.target_id
  group by r.target_id,p.display_name,u.raw_user_meta_data
  limit 200) q),'[]'::jsonb);
end; $$;
revoke all on function public.poker_admin_reports() from public,anon;
grant execute on function public.poker_admin_reports() to authenticated;

create or replace function public.poker_admin_ban(p_member uuid,p_days integer,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if who is null or not coalesce(public.is_admin(),false) then raise exception 'Admin required'; end if;
 if p_member is null then raise exception 'Invalid member'; end if;
 if p_days is null then -- lift
  delete from poker_private.poker_bans where member_id=p_member;
  update poker_private.member_reports set status='done' where target_id=p_member and status='open';
  return jsonb_build_object('banned',false);
 end if;
 -- p_days: 0 = until lifted, 1..3650 = that many days; null lifts the ban.
 if p_days<0 or p_days>3650 then raise exception 'Invalid days'; end if;
 insert into poker_private.poker_bans(member_id,until,reason,created_by) values(p_member,case when p_days=0 then null else now()+make_interval(days=>p_days) end,left(coalesce(p_reason,''),500),who)
 on conflict(member_id) do update set until=excluded.until,reason=excluded.reason,created_by=excluded.created_by,created_at=now();
 update poker_private.member_reports set status='done' where target_id=p_member and status='open';
 return jsonb_build_object('banned',true);
end; $$;
revoke all on function public.poker_admin_ban(uuid,integer,text) from public,anon;
grant execute on function public.poker_admin_ban(uuid,integer,text) to authenticated;
