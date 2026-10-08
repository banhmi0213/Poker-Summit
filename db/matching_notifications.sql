create table public.matching_notifications(
 id uuid primary key default gen_random_uuid(),record_id uuid not null references public.dealer_matching_records(id),
 recipient_id uuid not null references auth.users(id),recipient_actor text not null check(recipient_actor in ('store','dealer')),
 sender_id uuid not null references auth.users(id),event_id uuid not null,kind text not null check(kind in ('application','offer','message')),
 created_at timestamptz not null default now(),read_at timestamptz,
 unique(recipient_id,event_id,kind)
);
create index matching_notifications_unread on public.matching_notifications(recipient_id,recipient_actor,record_id) where read_at is null;
alter table public.matching_notifications enable row level security;
revoke all on public.matching_notifications from anon,authenticated;
grant select on public.matching_notifications to authenticated;
create policy matching_notification_recipient on public.matching_notifications for select to authenticated using(recipient_id=(select auth.uid()) and private.chat_actor(record_id) is not null);
create table private.matching_notification_delivery(
 notification_id uuid not null references public.matching_notifications(id),channel text not null check(channel in ('email','line')),
 state text not null default 'pending' check(state in ('pending','sending','sent','skipped','failed')),
 attempts integer not null default 0,next_attempt_at timestamptz not null default now(),lock_token uuid,
 first_attempt_at timestamptz,updated_at timestamptz not null default now(),last_error text,
 primary key(notification_id,channel)
);
alter table private.matching_notification_delivery enable row level security;
revoke all on private.matching_notification_delivery from public,anon,authenticated;
create index matching_delivery_due on private.matching_notification_delivery(next_attempt_at) where state in ('pending','sending');
create function private.enqueue_matching_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.dealer_matching_records;v_sender uuid;v_recipient uuid;v_actor text;v_kind text;v_event uuid;v_id uuid;v_owner uuid;
begin
 if tg_table_name='dealer_matching_records' then r:=new;v_event:=new.id;else select * into r from public.dealer_matching_records where id=new.record_id;v_event:=new.id;end if;
 select owner_user_id into v_owner from public.stores where id=r.store_id;
 if tg_table_name='dealer_matching_records' then
  if r.job_snapshot->>'source'='store_offer' then v_sender:=v_owner;v_recipient:=r.dealer_user_id;v_actor:='dealer';v_kind:='offer';
  else v_sender:=r.dealer_user_id;v_recipient:=v_owner;v_actor:='store';v_kind:='application';end if;
 else
  v_sender:=new.sender_id;v_kind:='message';
  if v_sender=r.dealer_user_id then v_recipient:=v_owner;v_actor:='store';elsif v_sender=v_owner then v_recipient:=r.dealer_user_id;v_actor:='dealer';else return new;end if;
 end if;
 if v_sender is null or v_recipient is null or v_sender=v_recipient or exists(select 1 from public.member_status where user_id in(v_sender,v_recipient) and suspended) then return new;end if;
 insert into public.matching_notifications(record_id,recipient_id,recipient_actor,sender_id,event_id,kind)values(r.id,v_recipient,v_actor,v_sender,v_event,v_kind)on conflict do nothing returning id into v_id;
 if v_id is not null then
  insert into private.matching_notification_delivery(notification_id,channel)values(v_id,'email');
  if v_actor='store' then insert into private.matching_notification_delivery(notification_id,channel)values(v_id,'line');end if;
 end if;
 return new;
end $$;
revoke all on function private.enqueue_matching_notification() from public,anon,authenticated;
create trigger matching_application_notification after insert on public.dealer_matching_records for each row execute function private.enqueue_matching_notification();
create trigger matching_message_notification after insert on public.dealer_chat_messages for each row execute function private.enqueue_matching_notification();
create function private.mark_matching_notifications(p_record uuid,p_events uuid[]) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.chat_ready(p_record) or coalesce(cardinality(p_events),0)>51 then raise exception 'このチャットは利用できません。';end if;
 update public.matching_notifications set read_at=now() where recipient_id=auth.uid() and record_id=p_record and event_id=any(p_events) and read_at is null;
end $$;
create function public.mark_matching_notifications(p_record uuid,p_events uuid[]) returns void language sql set search_path='' as $$select private.mark_matching_notifications(p_record,p_events)$$;
revoke all on function private.mark_matching_notifications(uuid,uuid[]),public.mark_matching_notifications(uuid,uuid[]) from public,anon;
grant execute on function private.mark_matching_notifications(uuid,uuid[]),public.mark_matching_notifications(uuid,uuid[]) to authenticated;
create function private.claim_matching_notifications(p_record uuid default null) returns table(notification_id uuid,channel text,lock_token uuid,recipient_actor text,kind text,record_id uuid,recipient_email text,line_user_id text) language plpgsql security definer set search_path='' as $$
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Server only';end if;
 update private.matching_notification_delivery set state='failed',last_error='retry_window_expired',updated_at=now() where state in ('pending','sending') and first_attempt_at<now()-interval '23 hours';
 return query
 with due as (
 select d.notification_id,d.channel from private.matching_notification_delivery d join public.matching_notifications n on n.id=d.notification_id
 where (p_record is null or n.record_id=p_record) and d.state in ('pending','sending') and d.next_attempt_at<=now() and d.attempts<5
 order by d.next_attempt_at limit 20 for update of d skip locked
 ),claimed as (
 update private.matching_notification_delivery d set state='sending',attempts=d.attempts+1,first_attempt_at=coalesce(d.first_attempt_at,now()),next_attempt_at=now()+interval '2 minutes',lock_token=gen_random_uuid(),updated_at=now()
 from due where d.notification_id=due.notification_id and d.channel=due.channel returning d.*
 )
 select c.notification_id,c.channel,c.lock_token,n.recipient_actor,n.kind,n.record_id,
 case when exists(select 1 from public.member_status m where m.user_id in(n.recipient_id,n.sender_id) and m.suspended) or exists(select 1 from public.dealer_chat_blocks b where b.record_id=n.record_id) then null
 when n.recipient_actor='store' and s.owner_user_id<>n.recipient_id then null
 when n.recipient_actor='store' then coalesce((select sc.contact_email from public.store_contracts sc where sc.store_id=r.store_id and sc.status='active' order by sc.created_at desc limit 1),u.email)
 else u.email end::text,
 case when s.owner_user_id=n.recipient_id and not exists(select 1 from public.member_status m where m.user_id in(n.recipient_id,n.sender_id) and m.suspended) and not exists(select 1 from public.dealer_chat_blocks b where b.record_id=n.record_id) then s.line_user_id else null end::text
 from claimed c join public.matching_notifications n on n.id=c.notification_id join public.dealer_matching_records r on r.id=n.record_id join public.stores s on s.id=r.store_id join auth.users u on u.id=n.recipient_id;
end $$;
create function public.claim_matching_notifications(p_record uuid default null) returns table(notification_id uuid,channel text,lock_token uuid,recipient_actor text,kind text,record_id uuid,recipient_email text,line_user_id text) language sql set search_path='' as $$select * from private.claim_matching_notifications(p_record)$$;
create function private.finish_matching_notification(p_notification uuid,p_channel text,p_lock uuid,p_state text,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Server only';end if;
 if p_state not in ('sent','skipped','pending') then raise exception 'Invalid state';end if;
 update private.matching_notification_delivery set state=case when p_state='pending' and attempts>=5 then 'failed' else p_state end,next_attempt_at=now()+interval '5 minutes',last_error=left(p_error,120),updated_at=now() where notification_id=p_notification and channel=p_channel and lock_token=p_lock and state='sending';
end $$;
create function public.finish_matching_notification(p_notification uuid,p_channel text,p_lock uuid,p_state text,p_error text default null) returns void language sql set search_path='' as $$select private.finish_matching_notification(p_notification,p_channel,p_lock,p_state,p_error)$$;
revoke all on function private.claim_matching_notifications(uuid),public.claim_matching_notifications(uuid),private.finish_matching_notification(uuid,text,uuid,text,text),public.finish_matching_notification(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function private.claim_matching_notifications(uuid),public.claim_matching_notifications(uuid),private.finish_matching_notification(uuid,text,uuid,text,text),public.finish_matching_notification(uuid,text,uuid,text,text) to service_role;
create function public.matching_unread_rooms(p_actor text,p_page integer default 1) returns table(record_id uuid,unread bigint,latest timestamptz) language sql stable set search_path='' as $$
 select n.record_id,count(*),max(n.created_at) from public.matching_notifications n where n.recipient_id=auth.uid() and n.recipient_actor=p_actor and n.read_at is null group by n.record_id order by max(n.created_at) desc,n.record_id limit 6 offset (greatest(1,least(p_page,10000))-1)*6
$$;
revoke all on function public.matching_unread_rooms(text,integer) from public,anon;
grant execute on function public.matching_unread_rooms(text,integer) to authenticated;
