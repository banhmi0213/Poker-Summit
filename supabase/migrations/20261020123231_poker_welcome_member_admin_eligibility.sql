begin;
-- An administrator with a normal confirmed member email can also play.
create or replace function poker_private.ensure_ring_welcome(p_member uuid) returns void language plpgsql security definer set search_path='' as $$
declare email_address text; identity bytea; accepted uuid;
begin
 select lower(btrim(u.email)) into email_address from auth.users u where u.id=p_member and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and u.deleted_at is null and (u.banned_until is null or u.banned_until<now()) and u.email is not null and u.email not ilike '%@login.poker-summit.jp' and not exists(select 1 from public.member_status s where s.user_id=u.id and s.suspended) for key share;
 if email_address is null then return;end if;
 insert into poker_private.ring_accounts(member_id) values(p_member) on conflict do nothing;
 perform 1 from poker_private.ring_accounts where member_id=p_member for update;
 if exists(select 1 from poker_private.ring_welcome_claims where member_id=p_member) then return;end if;
 select extensions.hmac(convert_to(email_address,'UTF8'),secret,'sha256') into identity from poker_private.ring_identity_secret where id;
 insert into poker_private.ring_welcome_claims(identity_key,member_id) values(identity,p_member) on conflict do nothing returning member_id into accepted;
 if accepted is null then return;end if;
 update poker_private.ring_accounts set available=available+3000,updated_at=now() where member_id=p_member;
 insert into poker_private.ring_chip_ledger(member_id,request_id,kind,available_delta,in_play_delta) values(p_member,gen_random_uuid(),'welcome',3000,0);
end;$$;

create or replace function poker_private.ring_balance() returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); result jsonb;
begin
 if who is null or coalesce(public.is_suspended(),true) then raise exception 'Login required';end if;
 perform poker_private.ensure_ring_welcome(who);
 select jsonb_build_object('available',a.available,'inPlay',a.in_play,'total',a.available+a.in_play,
 'rank',1+(select count(*) from poker_private.ring_accounts other join auth.users u on u.id=other.member_id where other.available+other.in_play>a.available+a.in_play and not coalesce(u.is_anonymous,false) and u.email_confirmed_at is not null and u.deleted_at is null),
 'welcomeGranted',exists(select 1 from poker_private.ring_welcome_claims where member_id=who),'asOf',now(),
 'history',coalesce((select jsonb_agg(to_jsonb(h)) from(select kind,available_delta as "availableDelta",in_play_delta as "inPlayDelta",created_at as "createdAt" from poker_private.ring_chip_ledger where member_id=who order by created_at desc,id desc limit 20) h),'[]'::jsonb)) into result from poker_private.ring_accounts a where member_id=who;
 return coalesce(result,jsonb_build_object('available',0,'inPlay',0,'total',0,'rank',null,'welcomeGranted',false,'asOf',now(),'history','[]'::jsonb));
end;$$;

commit;
