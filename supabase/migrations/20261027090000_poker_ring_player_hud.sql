-- Player HUD at ring tables (2026/10/27).
-- 1) poker_display.ring_member_profiles existed only on staging; it is recorded here so production gets it too.
--    It now also returns the viewer's own colour label for each seat and marks the viewer's seat.
-- 2) poker_ring_member_hud: tendency stats (ring hands only) for the member in one seat, plus the viewer's private note.
-- 3) poker_ring_member_note_set: private note / colour label, visible only to the member who wrote it.
-- Member ids never leave the database: callers address players by table + seat.
create schema if not exists poker_display;
revoke all on schema poker_display from public,anon;
grant usage on schema poker_display to authenticated;

create table if not exists poker_private.member_notes(
 owner_id uuid not null,
 target_id uuid not null,
 note text not null default '' check(length(note)<=500),
 color text check(color is null or color in('red','orange','yellow','green','blue','purple')),
 updated_at timestamptz not null default now(),
 primary key(owner_id,target_id),
 check(owner_id<>target_id)
);
alter table poker_private.member_notes enable row level security;
revoke all on poker_private.member_notes from public,anon,authenticated;

create or replace function poker_display.ring_member_profiles(p_table uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if who is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or public.is_suspended() is distinct from false then raise exception 'Not authorized'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('seat',r.seat_number,'displayName',left(coalesce(nullif(p.display_name,''),'会員'),80),'avatarUrl',p.avatar_url,
    'you',r.member_id=who,'color',n.color) order by r.seat_number),'[]'::jsonb)
  from poker_private.ring_fund_reservations r join public.poker_ring_tables t on t.id=r.table_id and t.published and t.deleted_at is null
  left join public.profiles p on p.user_id=r.member_id
  left join poker_private.member_notes n on n.owner_id=who and n.target_id=r.member_id
  where r.table_id=p_table and r.status='seated');
end; $$;
revoke all on function poker_display.ring_member_profiles(uuid) from public,anon;
grant execute on function poker_display.ring_member_profiles(uuid) to authenticated;

create or replace function public.poker_ring_member_profiles(p_table uuid)
returns jsonb language sql stable set search_path='' as $$select poker_display.ring_member_profiles(p_table);$$;
revoke all on function public.poker_ring_member_profiles(uuid) from public,anon;
grant execute on function public.poker_ring_member_profiles(uuid) to authenticated;

-- Seated member at a live published table, or null.
create or replace function poker_display.ring_seat_member(p_table uuid,p_seat integer)
returns uuid language sql stable security definer set search_path='' as $$
 select r.member_id from poker_private.ring_fund_reservations r join public.poker_ring_tables t on t.id=r.table_id and t.published and t.deleted_at is null
 where r.table_id=p_table and r.seat_number=p_seat and r.status='seated' limit 1;
$$;
revoke all on function poker_display.ring_seat_member(uuid,integer) from public,anon,authenticated;

create or replace function poker_display.ring_member_hud(p_table uuid,p_seat integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=auth.uid();target uuid;s jsonb;n record;
begin
 if who is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or public.is_suspended() is distinct from false then raise exception 'Not authorized'; end if;
 if p_seat is null or p_seat not between 1 and 6 then raise exception 'Invalid seat'; end if;
 target:=poker_display.ring_seat_member(p_table,p_seat);
 if target is null then return null; end if;
 s:=poker_private.hand_stats_summary(target,'ring');
 select note,color into n from poker_private.member_notes where owner_id=who and target_id=target;
 return jsonb_build_object('seat',p_seat,'you',target=who,
  'stats',jsonb_build_object('hands',s->'hands','vpip',s->'vpip','pfr',s->'pfr','threeBet',s->'three_bet','threeBetOpp',s->'three_bet_opp',
   'cbet',s->'cbet','cbetOpp',s->'cbet_opp','foldTo3Bet',s->'fold_to_3bet','foldTo3BetOpp',s->'fold_to_3bet_opp',
   'foldToCbet',s->'fold_to_cbet','foldToCbetOpp',s->'fold_to_cbet_opp','sawFlop',s->'saw_flop','wtsd',s->'wtsd','wsd',s->'wsd'),
  'note',case when target=who then null else coalesce(n.note,'') end,'color',case when target=who then null else n.color end);
end; $$;
revoke all on function poker_display.ring_member_hud(uuid,integer) from public,anon;
grant execute on function poker_display.ring_member_hud(uuid,integer) to authenticated;

create or replace function public.poker_ring_member_hud(p_table uuid,p_seat integer)
returns jsonb language sql stable set search_path='' as $$select poker_display.ring_member_hud(p_table,p_seat);$$;
revoke all on function public.poker_ring_member_hud(uuid,integer) from public,anon;
grant execute on function public.poker_ring_member_hud(uuid,integer) to authenticated;

create or replace function poker_display.ring_member_note_set(p_table uuid,p_seat integer,p_note text,p_color text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();target uuid;clean text:=left(btrim(coalesce(p_note,'')),500);
begin
 if who is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or public.is_suspended() is distinct from false then raise exception 'Not authorized'; end if;
 if p_seat is null or p_seat not between 1 and 6 then raise exception 'Invalid seat'; end if;
 if p_color is not null and p_color not in('red','orange','yellow','green','blue','purple') then raise exception 'Invalid color'; end if;
 target:=poker_display.ring_seat_member(p_table,p_seat);
 if target is null then raise exception 'Seat is empty'; end if;
 if target=who then raise exception 'Cannot note yourself'; end if;
 if clean='' and p_color is null then
  delete from poker_private.member_notes where owner_id=who and target_id=target;
 else
  insert into poker_private.member_notes(owner_id,target_id,note,color,updated_at) values(who,target,clean,p_color,now())
  on conflict(owner_id,target_id) do update set note=excluded.note,color=excluded.color,updated_at=now();
 end if;
 return jsonb_build_object('seat',p_seat,'note',clean,'color',p_color);
end; $$;
revoke all on function poker_display.ring_member_note_set(uuid,integer,text,text) from public,anon;
grant execute on function poker_display.ring_member_note_set(uuid,integer,text,text) to authenticated;

create or replace function public.poker_ring_member_note_set(p_table uuid,p_seat integer,p_note text,p_color text)
returns jsonb language sql set search_path='' as $$select poker_display.ring_member_note_set(p_table,p_seat,p_note,p_color);$$;
revoke all on function public.poker_ring_member_note_set(uuid,integer,text,text) from public,anon;
grant execute on function public.poker_ring_member_note_set(uuid,integer,text,text) to authenticated;
