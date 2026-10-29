-- Hand sharing for the board (owner 2026/10/27: 「掲示板で相談する」 from the hand history).
-- A share is a frozen, viewer-safe copy of the poster's own view of the hand: their own cards and cards shown at
-- showdown only. Other players are anonymised (プレイヤー<seat>), no member ids are kept. Readable by signed-in members.
create table if not exists poker_private.hand_shares(
 id uuid primary key default gen_random_uuid(),
 hand_id uuid not null,
 owner_id uuid not null,
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object' and length(snapshot::text)<=200000),
 created_at timestamptz not null default now(),
 unique(owner_id,hand_id)
);
create index if not exists hand_shares_owner on poker_private.hand_shares(owner_id,created_at desc);
alter table poker_private.hand_shares enable row level security;
revoke all on poker_private.hand_shares from public,anon,authenticated;

create or replace function public.poker_hand_share(p_hand uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();h poker_private.hand_histories;view jsonb;sid uuid;
begin
 if who is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or coalesce(public.is_suspended(),true) then raise exception 'Login required'; end if;
 select id into sid from poker_private.hand_shares where owner_id=who and hand_id=p_hand;
 if sid is not null then return sid; end if;
 select * into h from poker_private.hand_histories where hand_id=p_hand;
 if not found or not exists(select 1 from poker_private.hand_history_members m where m.hand_id=p_hand and m.member_id=who) then raise exception 'Hand not available'; end if;
 if (select count(*) from poker_private.hand_shares s where s.owner_id=who and s.created_at>now()-interval '1 day')>=30 then raise exception 'Too many shares'; end if;
 view:=poker_private.hand_history_view(h,who,false);
 view:=jsonb_set(view,'{players}',(select jsonb_agg(case when (p->>'you')::boolean then p||jsonb_build_object('name','投稿者') else p||jsonb_build_object('name','プレイヤー'||(p->>'seat')) end order by (p->>'seat')::integer) from jsonb_array_elements(view->'players') p));
 insert into poker_private.hand_shares(hand_id,owner_id,snapshot) values(p_hand,who,view) returning id into sid;
 return sid;
end; $$;
revoke all on function public.poker_hand_share(uuid) from public,anon;
grant execute on function public.poker_hand_share(uuid) to authenticated;

create or replace function public.poker_hand_share_view(p_share uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=auth.uid();s poker_private.hand_shares;
begin
 if who is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or coalesce(public.is_suspended(),true) then raise exception 'Login required'; end if;
 select * into s from poker_private.hand_shares where id=p_share;
 if not found then return null; end if;
 return s.snapshot||jsonb_build_object('shareId',s.id,'sharedAt',s.created_at,'mine',s.owner_id=who);
end; $$;
revoke all on function public.poker_hand_share_view(uuid) from public,anon;
grant execute on function public.poker_hand_share_view(uuid) to authenticated;
