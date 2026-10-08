-- Participant-only chat. Writes go through narrow RPCs; no direct client writes.
create table public.dealer_chat_consents (
 record_id uuid not null references public.dealer_matching_records(id),
 user_id uuid not null references auth.users(id),
 version text not null, accepted_at timestamptz not null default now(),
 primary key(record_id,user_id,version)
);
create table public.dealer_chat_terms (
 record_id uuid primary key references public.dealer_matching_records(id),
 revision integer not null default 1,
 contract_type text not null check(contract_type in ('employment','contract')),
 payment_method text not null check(payment_method in ('bank','cash')),
 payment_date text not null check(length(payment_date) between 1 and 100),
 notes text not null default '' check(length(notes)<=2000),
 updated_by uuid not null references auth.users(id), updated_at timestamptz not null default now()
);
create table public.dealer_chat_messages (
 id uuid primary key default gen_random_uuid(),
 record_id uuid not null references public.dealer_matching_records(id),
 sender_id uuid not null references auth.users(id),
 body text not null check(length(body) between 1 and 2000),
 nonce uuid not null, created_at timestamptz not null default now(),
 unique(record_id,sender_id,nonce)
);
create index dealer_chat_messages_room_time on public.dealer_chat_messages(record_id,created_at desc,id);
create index dealer_chat_messages_sender_time on public.dealer_chat_messages(sender_id,created_at desc);
create table public.dealer_chat_blocks (
 record_id uuid not null references public.dealer_matching_records(id),
 user_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 primary key(record_id,user_id)
);
create table public.dealer_chat_reports (
 id uuid primary key default gen_random_uuid(),record_id uuid not null references public.dealer_matching_records(id),
 reporter_id uuid not null references auth.users(id),
 reason text not null check(length(reason) between 1 and 2000),
 status text not null default 'open' check(status in ('open','resolved')),
 created_at timestamptz not null default now(),resolved_at timestamptz, resolved_by uuid references auth.users(id)
);
create index dealer_chat_reports_status_time on public.dealer_chat_reports(status,created_at desc);

create or replace function private.chat_actor(p_record uuid) returns text language sql stable security definer set search_path='' as $$
 select case when r.dealer_user_id=auth.uid() then 'dealer' else 'store' end
 from public.dealer_matching_records r join public.stores s on s.id=r.store_id
 where auth.uid() is not null and not public.is_suspended()
 and (r.dealer_user_id=auth.uid() or s.owner_user_id=auth.uid())
 and exists(select 1 from public.dealer_profiles d where d.user_id=r.dealer_user_id)
 and not exists(select 1 from public.member_status m where m.user_id in (r.dealer_user_id,s.owner_user_id) and m.suspended)
 limit 1;
$$;
create or replace function private.chat_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not public.is_suspended() and exists(select 1 from public.admin_users where user_id=auth.uid() and active);
$$;
create or replace function private.chat_ready(p_record uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.chat_actor(p_record) is not null
 and exists(select 1 from public.dealer_chat_consents c where c.record_id=p_record and c.user_id=auth.uid() and c.version='2026-10-08-chat-v1')
 and exists(select 1 from public.user_legal_consents c where c.user_id=auth.uid() and c.scope='matching_'||private.chat_actor(p_record) and c.terms_version='2026-10-07' and c.privacy_version='2026-10-07' and c.rules_version='2026-10-07');
$$;
create or replace function private.chat_reported(p_record uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.chat_admin() and exists(select 1 from public.dealer_chat_reports where record_id=p_record);
$$;

alter table public.dealer_chat_consents enable row level security;
alter table public.dealer_chat_terms enable row level security;
alter table public.dealer_chat_messages enable row level security;
alter table public.dealer_chat_blocks enable row level security;
alter table public.dealer_chat_reports enable row level security;
revoke all on public.dealer_chat_consents, public.dealer_chat_terms,public.dealer_chat_messages,public.dealer_chat_blocks,public.dealer_chat_reports from anon,authenticated;
grant select on public.dealer_chat_consents,public.dealer_chat_terms,public.dealer_chat_messages,public.dealer_chat_blocks,public.dealer_chat_reports to authenticated;
create policy chat_consent_own on public.dealer_chat_consents for select to authenticated using(user_id=(select auth.uid()) and private.chat_actor(record_id) is not null);
create policy chat_terms_participant on public.dealer_chat_terms for select to authenticated using(private.chat_ready(record_id) or private.chat_reported(record_id));
create policy chat_messages_participant on public.dealer_chat_messages for select to authenticated using(private.chat_ready(record_id) or private.chat_reported(record_id));
create policy chat_blocks_participant on public.dealer_chat_blocks for select to authenticated using(private.chat_ready(record_id));
create policy chat_reports_admin on public.dealer_chat_reports for select to authenticated using((select private.chat_admin()) or (reporter_id=(select auth.uid()) and private.chat_ready(record_id)));

create or replace function private.chat_operation(p_record uuid,p_operation text,p_payload jsonb default '{}') returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor text; r public.dealer_matching_records; v_id uuid; v_body text; v_revision integer; v_nonce uuid;
begin
 v_actor:=private.chat_actor(p_record);
 if v_actor is null then raise exception 'このチャットは利用できません。'; end if;
 -- Match update_spot_work's lock order for race-safe capacity/condition changes.
 perform 1 from public.spot_jobs where id=(select spot_job_id from public.dealer_matching_records where id=p_record) for update;
 select * into r from public.dealer_matching_records where id=p_record for update;
 if not exists(select 1 from public.user_legal_consents where user_id=auth.uid() and scope='matching_'||v_actor and terms_version='2026-10-07' and privacy_version='2026-10-07' and rules_version='2026-10-07') then raise exception '利用規約への同意が必要です。'; end if;
 if p_operation='consent' then
  insert into public.dealer_chat_consents(record_id,user_id,version) values(p_record,auth.uid(),'2026-10-08-chat-v1') on conflict do nothing;
  return p_record;
 end if;
 if not private.chat_ready(p_record) then raise exception 'チャットの注意事項に同意してください。'; end if;
 if p_operation='block' then
  insert into public.dealer_chat_blocks(record_id,user_id) values(p_record,auth.uid()) on conflict do nothing; return p_record;
 elsif p_operation='unblock' then
  delete from public.dealer_chat_blocks where record_id=p_record and user_id=auth.uid(); return p_record;
 elsif p_operation='report' then
  v_body:=btrim(coalesce(p_payload->>'reason',''));
  if length(v_body) not between 1 and 2000 then raise exception '通報理由を1〜2000文字で記載してください。'; end if;
  if exists(select 1 from public.dealer_chat_reports where record_id=p_record and reporter_id=auth.uid() and status='open') then raise exception 'このチャットは通報済みです。'; end if;
  insert into public.dealer_chat_reports(record_id,reporter_id,reason) values(p_record,auth.uid(),v_body) returning id into v_id; return v_id;
 end if;
 if exists(select 1 from public.dealer_chat_blocks where record_id=p_record) then raise exception 'ブロック中のため送信・条件変更・合意はできません。'; end if;
 if p_operation='send' then
  v_body:=btrim(coalesce(p_payload->>'body','')); v_nonce:=(p_payload->>'nonce')::uuid;
  if v_nonce is null or length(v_body) not between 1 and 2000 then raise exception 'メッセージは1〜2000文字で記載してください。'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select id into v_id from public.dealer_chat_messages where record_id=p_record and sender_id=auth.uid() and nonce=v_nonce;
  if found then return v_id; end if;
  if exists(select 1 from public.dealer_chat_messages where sender_id=auth.uid() and created_at>now()-interval '2 seconds') then raise exception '少し待ってから送信してください。'; end if;
  if r.status not in ('confirmed','completed') and v_body ~* '(@|line|ライン|https?://|www\.|(0|\+)[0-9() -]{8,}[0-9])' then raise exception '合意前の連絡先交換・外部誘導はできません。'; end if;
  insert into public.dealer_chat_messages(record_id,sender_id,body,nonce) values(p_record,auth.uid(),v_body,v_nonce) returning id into v_id; return v_id;
 elsif p_operation='terms' then
  if v_actor<>'store' or r.status<>'pending' or r.work_start<=now() then raise exception '勤務開始前・合意前に店舗が条件を設定してください。'; end if;
  if coalesce(p_payload->>'contract_type','') not in ('employment','contract') or coalesce(p_payload->>'payment_method','') not in ('bank','cash') or length(btrim(coalesce(p_payload->>'payment_date',''))) not between 1 and 100 or length(coalesce(p_payload->>'notes',''))>2000 then raise exception '契約形態・支払方法・支払日を確認してください。'; end if;
  if (coalesce(p_payload->>'notes','')||' '||coalesce(p_payload->>'payment_date','')) ~* '(@|line|ライン|https?://|www\.|(0|\+)[0-9() -]{8,}[0-9])' then raise exception '合意前の連絡先交換・外部誘導はできません。'; end if;
  select revision into v_revision from public.dealer_chat_terms where record_id=p_record;
  if coalesce(v_revision,0)<>coalesce((p_payload->>'revision')::integer,0) then raise exception '条件が更新されています。ページを更新してください。'; end if;
  insert into public.dealer_chat_terms(record_id,revision,contract_type,payment_method,payment_date,notes,updated_by)
  values(p_record,1,p_payload->>'contract_type',p_payload->>'payment_method',btrim(p_payload->>'payment_date'),coalesce(p_payload->>'notes',''),auth.uid())
  on conflict(record_id) do update set revision=public.dealer_chat_terms.revision+1,contract_type=excluded.contract_type,payment_method=excluded.payment_method,payment_date=excluded.payment_date,notes=excluded.notes,updated_by=auth.uid(),updated_at=now();
  update public.dealer_matching_records set store_confirmed_at=null,dealer_confirmed_at=null where id=p_record;
  return p_record;
 elsif p_operation='confirm' then
  select revision into v_revision from public.dealer_chat_terms where record_id=p_record;
  if v_revision is null or v_revision<>coalesce((p_payload->>'revision')::integer,0) then raise exception '最新の勤務条件を確認してください。'; end if;
  perform set_config('app.chat.confirm_record',p_record::text,true);
  perform set_config('app.chat.confirm_revision',v_revision::text,true);
  perform private.update_spot_work(p_record,v_actor,'confirm',null); return p_record;
 end if;
 raise exception '操作を確認してください。';
end;
$$;
create function public.dealer_chat_operation(p_record uuid,p_operation text,p_payload jsonb default '{}') returns uuid language sql set search_path='' as $$select private.chat_operation(p_record,p_operation,p_payload)$$;

-- Stores offer a published shift; snapshot semantics match dealer applications.
create function private.offer_spot_work(p_dealer uuid,p_job uuid,p_date date) returns uuid language plpgsql security definer set search_path='' as $$
declare j public.spot_jobs;s public.spot_job_shifts;v_start timestamptz;v_end timestamptz;v_id uuid;v_name text;v_dealer text;
begin
 if auth.uid() is null or public.is_suspended() then raise exception '利用できません。'; end if;
 if not exists(select 1 from public.user_legal_consents where user_id=auth.uid() and scope='matching_store' and terms_version='2026-10-07' and privacy_version='2026-10-07' and rules_version='2026-10-07') then raise exception '規約に同意してください。'; end if;
 select * into j from public.spot_jobs where id=p_job and published and deadline>now() for update;
 if not found or not exists(select 1 from public.stores where id=j.store_id and owner_user_id=auth.uid()) then raise exception '自店舗の公開中の求人を選んでください。'; end if;
 if p_dealer=auth.uid() or not exists(select 1 from public.dealer_profiles where user_id=p_dealer and published) or exists(select 1 from public.member_status where user_id=p_dealer and suspended) then raise exception 'このディーラーにオファーできません。'; end if;
 select * into s from public.spot_job_shifts where job_id=j.id and work_date=p_date;
 if not found then raise exception '勤務日を選んでください。'; end if;
 v_start:=(s.work_date+s.start_time) at time zone 'Asia/Tokyo';
 v_end:=((s.work_date+case when s.end_time<=s.start_time then 1 else 0 end)+s.end_time) at time zone 'Asia/Tokyo';
 if v_start<=now() then raise exception '勤務開始前にオファーしてください。'; end if;
 select name into v_name from public.stores where id=j.store_id;
 select full_name into v_dealer from public.dealer_profiles where user_id=p_dealer;
 insert into public.dealer_matching_records(store_id,dealer_user_id,work_start,work_end,spot_job_id,job_snapshot)
 values(j.store_id,p_dealer,v_start,v_end,j.id,jsonb_build_object('store_name',v_name,'dealer_name',v_dealer,'games',j.games,'duties',j.duties,'requirements',j.requirements,'transport_type',j.transport_type,'transport_limit',j.transport_limit,'dress',j.dress,'hourly_wage',s.hourly_wage,'headcount',s.headcount,'source','store_offer'))
 on conflict(spot_job_id,dealer_user_id,work_start) do nothing returning id into v_id;
 if v_id is null then select id into v_id from public.dealer_matching_records where spot_job_id=j.id and dealer_user_id=p_dealer and work_start=v_start; end if;
 return v_id;
end;
$$;
create function public.offer_spot_work(p_dealer uuid,p_job uuid,p_date date) returns uuid language sql set search_path='' as $$select private.offer_spot_work(p_dealer,p_job,p_date)$$;

create function private.resolve_chat_report(p_report uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.chat_admin() then raise exception '運営権限が必要です。'; end if;
 update public.dealer_chat_reports set status='resolved',resolved_at=now(),resolved_by=auth.uid() where id=p_report and status='open';
end;
$$;
create function public.resolve_dealer_chat_report(p_report uuid) returns void language sql set search_path='' as $$select private.resolve_chat_report(p_report)$$;

revoke all on function private.chat_actor(uuid),private.chat_admin(),private.chat_ready(uuid),private.chat_reported(uuid),private.chat_operation(uuid,text,jsonb),private.offer_spot_work(uuid,uuid,date),private.resolve_chat_report(uuid) from public,anon;
grant execute on function private.chat_actor(uuid),private.chat_admin(),private.chat_ready(uuid),private.chat_reported(uuid),private.chat_operation(uuid,text,jsonb),private.offer_spot_work(uuid,uuid,date),private.resolve_chat_report(uuid) to authenticated;
revoke all on function public.dealer_chat_operation(uuid,text,jsonb),public.offer_spot_work(uuid,uuid,date),public.resolve_dealer_chat_report(uuid) from public,anon;
grant execute on function public.dealer_chat_operation(uuid,text,jsonb),public.offer_spot_work(uuid,uuid,date),public.resolve_dealer_chat_report(uuid) to authenticated;
