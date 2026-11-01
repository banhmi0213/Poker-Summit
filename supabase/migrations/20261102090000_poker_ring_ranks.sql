-- リングの段位(オーナー 2026/11/01)。
-- 通算のBB(リングのハンドの勝ち負けをBBで数えたもの。レーキを引いた後)で決める。
--   0 ルーキー   リングで100ハンドまで
--   1 ブロンズ   〜99BB(マイナスを含む)
--   2 シルバー   100BB〜
--   3 ゴールド   300BB〜
--   4 プラチナ   1,000BB〜  ここから上位卓(5/10・10/20)。1/2には座れない。チップの基準は3,000
--   5 ダイヤモンド 3,000BB〜
--   6 レジェンド 6,000BB〜
-- 下限を割ったらその場で下がる(都度の上げ下げ)。プラチナ以上が上位卓より下の卓(2/5)で勝った分は半分だけ数える。
-- 区切りの数字は公開後の実データで調整する(poker_private.ring_tier だけ変えればよい)。
begin;

create table if not exists poker_private.ring_ranks(
 member_id uuid primary key references auth.users(id) on delete cascade,
 bb_total numeric(14,2) not null default 0,
 hands integer not null default 0 check(hands>=0),
 last_played timestamptz,
 last_hand uuid,
 updated_at timestamptz not null default now()
);
alter table poker_private.ring_ranks enable row level security;
revoke all on poker_private.ring_ranks from public,anon,authenticated;

-- 卓ごとの段位の条件(0〜6)。1/2はゴールドまで、5/10・10/20はプラチナから。
alter table public.poker_ring_tables add column if not exists min_tier smallint not null default 0 check(min_tier between 0 and 6);
alter table public.poker_ring_tables add column if not exists max_tier smallint not null default 6 check(max_tier between 0 and 6);
alter table public.poker_ring_tables drop constraint if exists poker_ring_tables_tier_range;
alter table public.poker_ring_tables add constraint poker_ring_tables_tier_range check(min_tier<=max_tier);

create or replace function poker_private.ring_tier(p_bb numeric,p_hands integer) returns smallint language sql immutable set search_path='' as $$
 select (case when coalesce(p_hands,0)<100 then 0
  when p_bb>=6000 then 6 when p_bb>=3000 then 5 when p_bb>=1000 then 4
  when p_bb>=300 then 3 when p_bb>=100 then 2 else 1 end)::smallint
$$;
revoke all on function poker_private.ring_tier(numeric,integer) from public,anon,authenticated;

-- 新しいリングのハンドを、時間の順に段位へ足し込む(30秒より前のハンドだけ。精算の途中を数えないため)。
create or replace function poker_private.ring_rank_refresh(p_member uuid) returns poker_private.ring_ranks language plpgsql security definer set search_path='' as $$
declare r poker_private.ring_ranks%rowtype; h record; tier smallint; delta numeric;
begin
 insert into poker_private.ring_ranks(member_id) values(p_member) on conflict do nothing;
 select * into r from poker_private.ring_ranks where member_id=p_member for update;
 for h in
  select m.hand_id,m.net,m.bb,m.played_at,coalesce(t.min_tier,0) table_min
  from poker_private.hand_history_members m
  join poker_private.hand_histories hh on hh.hand_id=m.hand_id and hh.kind='ring'
  left join public.poker_ring_tables t on t.id=hh.source_id
  where m.member_id=p_member and m.bb>0 and m.played_at<now()-interval '30 seconds'
    and (r.last_played is null or (m.played_at,m.hand_id)>(r.last_played,r.last_hand))
  order by m.played_at,m.hand_id
 loop
  tier:=poker_private.ring_tier(r.bb_total,r.hands);
  delta:=h.net::numeric/h.bb;
  -- プラチナ以上が上位卓より下の卓で勝った分は半分(負けた分はそのまま)。
  if tier>=4 and h.table_min<4 and delta>0 then delta:=delta/2;end if;
  r.bb_total:=round(r.bb_total+delta,2);r.hands:=r.hands+1;r.last_played:=h.played_at;r.last_hand:=h.hand_id;
 end loop;
 update poker_private.ring_ranks set bb_total=r.bb_total,hands=r.hands,last_played=r.last_played,last_hand=r.last_hand,updated_at=now() where member_id=p_member;
 return r;
end;$$;
revoke all on function poker_private.ring_rank_refresh(uuid) from public,anon,authenticated;

create or replace function poker_private.ring_member_tier(p_member uuid) returns smallint language plpgsql security definer set search_path='' as $$
declare r poker_private.ring_ranks%rowtype;
begin r:=poker_private.ring_rank_refresh(p_member);return poker_private.ring_tier(r.bb_total,r.hands);end;$$;
revoke all on function poker_private.ring_member_tier(uuid) from public,anon,authenticated;

-- チップの基準額: プラチナ以上は3,000、それ以外は1,000(毎月のリセットと無料補充)。
create or replace function poker_private.ring_base_chips(p_member uuid) returns bigint language sql security definer set search_path='' as $$
 select case when poker_private.ring_member_tier(p_member)>=4 then 3000 else 1000 end::bigint
$$;
revoke all on function poker_private.ring_base_chips(uuid) from public,anon,authenticated;

-- 着席の前に段位を確かめる(条件に合わない卓には座れない)。
create or replace function poker_private.guard_ring_tier() returns trigger language plpgsql security definer set search_path='' as $$
declare lo smallint; hi smallint; tier smallint;
begin
 select min_tier,max_tier into lo,hi from public.poker_ring_tables where id=new.table_id;
 if lo is null or (lo=0 and hi=6) then return new;end if;
 tier:=poker_private.ring_member_tier(new.member_id);
 if tier<lo or tier>hi then raise exception 'Rank not allowed at this table';end if;
 return new;
end;$$;
revoke all on function poker_private.guard_ring_tier() from public,anon,authenticated;
drop trigger if exists ring_tier_guard on poker_private.ring_fund_reservations;
create trigger ring_tier_guard before insert on poker_private.ring_fund_reservations for each row execute function poker_private.guard_ring_tier();

-- 毎月1日のリセット: 段位に合わせた基準額へ。
create or replace function poker_private.ensure_ring_season(p_member uuid) returns void language plpgsql security definer set search_path='' as $$
declare a poker_private.ring_accounts%rowtype; cur text:=to_char(now() at time zone 'Asia/Tokyo','YYYY-MM'); base bigint;
begin
 select * into a from poker_private.ring_accounts where member_id=p_member for update;
 if not found or a.season>=cur or a.in_play>0 then return;end if;
 base:=poker_private.ring_base_chips(p_member);
 insert into poker_private.ring_seasons(member_id,season,end_balance) values(p_member,a.season,a.available) on conflict do nothing;
 update poker_private.ring_accounts set available=base,season=cur,updated_at=now() where member_id=p_member;
 if a.available<>base then
  insert into poker_private.ring_chip_ledger(member_id,request_id,kind,available_delta,in_play_delta) values(p_member,gen_random_uuid(),'reset',base-a.available,0);
 end if;
end;$$;
revoke all on function poker_private.ensure_ring_season(uuid) from public,anon,authenticated,service_role;

-- 補充(オーナー 2026/11/01): 1日1回、段位で打つレートの100BBまで戻す。
--   ルーキー〜シルバー 200(1/2) / ゴールド 500(2/5) / プラチナ 1,000(5/10) / ダイヤ・レジェンド 2,000(10/20)
-- 卓に座っていない、かつ残高がその額より少ないときだけ。毎月1日の配布(1,000、プラチナ以上3,000)は別。
create or replace function poker_private.ring_refill_amount(p_member uuid) returns bigint language sql security definer set search_path='' as $$
 select case poker_private.ring_member_tier(p_member) when 3 then 500 when 4 then 1000 when 5 then 2000 when 6 then 2000 else 200 end::bigint
$$;
revoke all on function poker_private.ring_refill_amount(uuid) from public,anon,authenticated;
create or replace function public.poker_ring_refill(p_request uuid,p_table uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();a poker_private.ring_accounts%rowtype;amount bigint;
begin
 if who is null or p_request is null or coalesce(public.is_suspended(),true) or not poker_private.ring_member_eligible(who) then raise exception 'Login required';end if;
 perform poker_private.ensure_ring_welcome(who);
 perform poker_private.ensure_ring_season(who);
 select * into a from poker_private.ring_accounts where member_id=who for update;
 if not found then raise exception 'Account unavailable';end if;
 if exists(select 1 from poker_private.ring_chip_ledger where member_id=who and request_id=p_request) then return poker_private.ring_balance();end if;
 if p_table is not null and not exists(select 1 from public.poker_ring_tables where id=p_table and published and deleted_at is null) then raise exception 'Table unavailable';end if;
 amount:=poker_private.ring_refill_amount(who);
 if a.in_play>0 or a.available>=amount then raise exception 'Refill not needed';end if;
 update poker_private.ring_accounts set available=amount,updated_at=now() where member_id=who;
 insert into poker_private.ring_chip_ledger(member_id,request_id,kind,available_delta,in_play_delta) values(who,p_request,'refill',amount-a.available,0);
 return poker_private.ring_balance();
end;$$;
revoke all on function public.poker_ring_refill(uuid,uuid) from public,anon,service_role;
grant execute on function public.poker_ring_refill(uuid,uuid) to authenticated;

-- 補充は1日1回(日本時間)。着席回数の上限は今まで通り。
create or replace function poker_private.ring_ledger_throttle() returns trigger language plpgsql set search_path='' as $$
begin
 if new.kind='reserve' and (select count(*) from poker_private.ring_chip_ledger l where l.member_id=new.member_id and l.kind='reserve' and l.created_at>now()-interval '1 hour')>=30 then
  raise exception 'Too many seat changes' using hint='着席の回数が多すぎます。しばらく時間をおいてください。';
 end if;
 if new.kind='refill' and (select count(*) from poker_private.ring_chip_ledger l where l.member_id=new.member_id and l.kind='refill'
    and l.created_at>=(date_trunc('day',now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo'))>=1 then
  raise exception 'Refill limit reached' using hint='補充は1日1回までです。';
 end if;
 return new;
end; $$;

-- 自分の段位と、全体の中の位置(オーナー 2026/11/01: 全体のランキングは自分のマイページにだけ。自分がどの位置か分かるように)。
create or replace function public.poker_ring_rank() returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); r poker_private.ring_ranks%rowtype; tier smallint; place integer; total integer; m record;
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required';end if;
 r:=poker_private.ring_rank_refresh(who);tier:=poker_private.ring_tier(r.bb_total,r.hands);
 -- 他の会員の新しいハンドも数えてから順位を出す(新しいハンドがある人だけ)。
 for m in select distinct x.member_id from poker_private.hand_history_members x join poker_private.hand_histories hh on hh.hand_id=x.hand_id and hh.kind='ring'
   left join poker_private.ring_ranks rr on rr.member_id=x.member_id
   where x.member_id<>who and x.played_at<now()-interval '30 seconds' and (rr.last_played is null or x.played_at>rr.last_played) limit 500
 loop perform poker_private.ring_rank_refresh(m.member_id);end loop;
 select count(*)::integer into total from poker_private.ring_ranks where hands>0;
 select 1+count(*)::integer into place from poker_private.ring_ranks where hands>0 and bb_total>r.bb_total;
 return jsonb_build_object('tier',tier,'bb',r.bb_total,'hands',r.hands,
  'place',case when r.hands>0 then place else null end,'players',total,
  'next',case tier when 0 then null when 1 then 100 when 2 then 300 when 3 then 1000 when 4 then 3000 when 5 then 6000 else null end,
  'floor',case tier when 2 then 100 when 3 then 300 when 4 then 1000 when 5 then 3000 when 6 then 6000 else null end,
  'rookieHandsLeft',case when r.hands<100 then 100-r.hands else 0 end,
  'baseChips',case when tier>=4 then 3000 else 1000 end,
  'refillAmount',case tier when 3 then 500 when 4 then 1000 when 5 then 2000 when 6 then 2000 else 200 end,
  'refillUsedToday',exists(select 1 from poker_private.ring_chip_ledger l where l.member_id=who and l.kind='refill' and l.created_at>=(date_trunc('day',now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo')));
end;$$;
revoke all on function public.poker_ring_rank() from public,anon;
grant execute on function public.poker_ring_rank() to authenticated;

-- 運営: 同じ2人の間でチップが片方へ流れ続けていないか(オーナー 2026/11/01: 同じやり取りがあるかの監視)。
-- 勝った人が1人のハンドで、負けた各人から勝った人へ流れた分をBBで数え、2人の組ごとに差し引きで並べる。
create or replace function public.poker_admin_ring_pair_flows(p_days integer default 7,p_limit integer default 50) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.is_admin(),false) or coalesce(public.is_suspended(),true) then raise exception 'Admin required';end if;
 if p_days is null or p_days<1 or p_days>90 or p_limit is null or p_limit<1 or p_limit>200 then raise exception 'Invalid range';end if;
 return coalesce((select jsonb_agg(obj order by (obj->>'netBb')::numeric desc) from (
  select jsonb_build_object('winnerId',f.winner,'loserId',f.loser,
   'winnerName',coalesce(nullif(uw.raw_user_meta_data->>'display_name',''),'会員'),'loserName',coalesce(nullif(ul.raw_user_meta_data->>'display_name',''),'会員'),
   'winnerEmail',uw.email,'loserEmail',ul.email,
   'hands',f.hands,'headsUp',f.heads_up,'netBb',round(f.net_bb,1),'lastAt',f.last_at) obj
  from (
   select a.winner,a.loser,count(*)::integer hands,count(*) filter(where a.players=2)::integer heads_up,
    sum(a.bb_flow)-coalesce((select sum(b.bb_flow) from poker_private.ring_pair_flow_window(p_days) b where b.winner=a.loser and b.loser=a.winner),0) net_bb,
    max(a.played_at) last_at
   from poker_private.ring_pair_flow_window(p_days) a group by a.winner,a.loser
  ) f join auth.users uw on uw.id=f.winner join auth.users ul on ul.id=f.loser
  where f.net_bb>0 order by f.net_bb desc limit p_limit) q),'[]'::jsonb);
end;$$;

create or replace function poker_private.ring_pair_flow_window(p_days integer) returns table(winner uuid,loser uuid,bb_flow numeric,players integer,played_at timestamptz) language sql stable security definer set search_path='' as $$
 with hands as (
  select m.hand_id,m.member_id,m.net,m.bb,m.played_at,count(*) over(partition by m.hand_id) players,
   count(*) filter(where m.net>0) over(partition by m.hand_id) winners
  from poker_private.hand_history_members m join poker_private.hand_histories hh on hh.hand_id=m.hand_id and hh.kind='ring'
  where m.played_at>=now()-make_interval(days=>p_days) and m.bb>0)
 select w.member_id,l.member_id,(-l.net)::numeric/l.bb,w.players::integer,w.played_at
 from hands w join hands l on l.hand_id=w.hand_id and l.net<0
 where w.net>0 and w.winners=1
$$;
revoke all on function poker_private.ring_pair_flow_window(integer) from public,anon,authenticated;
revoke all on function public.poker_admin_ring_pair_flows(integer,integer) from public,anon;
grant execute on function public.poker_admin_ring_pair_flows(integer,integer) to authenticated;

-- 卓の条件: 1/2はゴールドまで、5/10はプラチナから。10/20の卓を2つ(低レーキ・高レーキ)プラチナから。
update public.poker_ring_tables set max_tier=3,updated_at=now() where deleted_at is null and sb=1 and bb=2 and title like 'SUMMIT 1/2%';
update public.poker_ring_tables set min_tier=4,updated_at=now() where deleted_at is null and sb=5 and bb=10 and title like 'SUMMIT 5/10%';
insert into public.poker_ring_tables(title,capacity,sb,bb,min_buy_in,max_buy_in,note,published,sort_order,rake_bps,rake_cap_bb,min_tier)
select v.title,6,10,20,800,2000,'プラチナ以上の卓',true,v.sort_order,v.rake_bps,v.rake_cap_bb,4
from (values('SUMMIT 10/20 #1 · 低レーキ（5%・上限5BB）',40,500,5),('SUMMIT 10/20 #2 · 高レーキ（10%・上限10BB）',41,1000,10)) v(title,sort_order,rake_bps,rake_cap_bb)
where not exists(select 1 from public.poker_ring_tables t where t.title=v.title and t.deleted_at is null)
  and exists(select 1 from public.poker_ring_tables t where t.title like 'SUMMIT 5/10%' and t.deleted_at is null);

-- 収支グラフ(オーナー 2026/11/01)。自分のリングの通算BBの推移を、最大300点に間引いて返す(段位と同じ数え方。2/5の半分ルールは
-- 段位の数え方なので、グラフは実際の勝ち負けそのまま)。
create or replace function public.poker_ring_bb_curve() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=auth.uid(); total integer;
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required';end if;
 select count(*) into total from poker_private.hand_history_members m join poker_private.hand_histories h on h.hand_id=m.hand_id and h.kind='ring' where m.member_id=who and m.bb>0;
 return coalesce((select jsonb_agg(jsonb_build_array(x.n,round(x.cum,1),x.played_at) order by x.n) from (
  select row_number() over(order by m.played_at,m.hand_id)::integer n,sum(m.net::numeric/m.bb) over(order by m.played_at,m.hand_id) cum,m.played_at
  from poker_private.hand_history_members m join poker_private.hand_histories h on h.hand_id=m.hand_id and h.kind='ring' where m.member_id=who and m.bb>0) x
  where total<=300 or x.n%greatest(1,ceil(total/300.0)::integer)=0 or x.n=total),'[]'::jsonb);
end;$$;
revoke all on function public.poker_ring_bb_curve() from public,anon;
grant execute on function public.poker_ring_bb_curve() to authenticated;

-- 管理画面で卓ごとの段位の条件を設定できるように。
create or replace function poker_private.admin_ring_save(p_id uuid,p_expected bigint,p_settings jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row public.poker_ring_tables%rowtype; v_id uuid;
begin
 if auth.uid() is null or not coalesce(public.is_admin(),false) or coalesce(public.is_suspended(),true) then raise exception 'Admin required'; end if;
 if jsonb_typeof(p_settings) is distinct from 'object' then raise exception 'Invalid settings'; end if;
 if p_id is not null then
  select * into row from public.poker_ring_tables where id=p_id for update;
  if not found or row.deleted_at is not null then raise exception 'Table not found'; end if;
  if row.revision is distinct from p_expected then raise exception 'Settings changed; reload'; end if;
 else
  if p_expected is distinct from 0 then raise exception 'Invalid new table revision'; end if;
 end if;
 v_id:=coalesce(p_id,gen_random_uuid());
 insert into public.poker_ring_tables(id,title,capacity,sb,bb,min_buy_in,max_buy_in,note,published,sort_order,rake_bps,rake_cap_bb,min_tier,max_tier)
 values(v_id,btrim(p_settings->>'title'),(p_settings->>'capacity')::smallint,(p_settings->>'sb')::integer,(p_settings->>'bb')::integer,
 (p_settings->>'min_buy_in')::integer,(p_settings->>'max_buy_in')::integer,coalesce(p_settings->>'note',''),(p_settings->>'published')::boolean,(p_settings->>'sort_order')::integer,
 coalesce((p_settings->>'rake_bps')::integer,500),coalesce((p_settings->>'rake_cap_bb')::integer,5),coalesce((p_settings->>'min_tier')::smallint,0),coalesce((p_settings->>'max_tier')::smallint,6))
 on conflict(id) do update set title=excluded.title,capacity=excluded.capacity,sb=excluded.sb,bb=excluded.bb,min_buy_in=excluded.min_buy_in,max_buy_in=excluded.max_buy_in,note=excluded.note,published=excluded.published,sort_order=excluded.sort_order,rake_bps=excluded.rake_bps,rake_cap_bb=excluded.rake_cap_bb,min_tier=excluded.min_tier,max_tier=excluded.max_tier,revision=public.poker_ring_tables.revision+1,updated_at=now();
 select * into row from public.poker_ring_tables where id=v_id;
 return to_jsonb(row);
end;$$;

-- 卓の席に段位バッジを出すため、席の会員情報に段位を足す(段位は着席のときなどに更新した値)。
create or replace function poker_display.ring_member_profiles(p_table uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if who is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or public.is_suspended() is distinct from false then raise exception 'Not authorized'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('seat',r.seat_number,'displayName',left(coalesce(nullif(p.display_name,''),'会員'),80),'avatarUrl',p.avatar_url,
    'you',r.member_id=who,'color',n.color,'frame',c.frame,'plate',c.plate,'tier',case when rr.member_id is null then 0 else poker_private.ring_tier(rr.bb_total,rr.hands) end) order by r.seat_number),'[]'::jsonb)
  from poker_private.ring_fund_reservations r join public.poker_ring_tables t on t.id=r.table_id and t.published and t.deleted_at is null
  left join public.profiles p on p.user_id=r.member_id
  left join poker_private.member_notes n on n.owner_id=who and n.target_id=r.member_id
  left join poker_private.member_cosmetics c on c.member_id=r.member_id
  left join poker_private.ring_ranks rr on rr.member_id=r.member_id
  where r.table_id=p_table and r.status='seated');
end; $$;

commit;
