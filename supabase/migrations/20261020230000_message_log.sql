-- サイトから送ったメール・LINEの記録(2026/10/20 オーナー指示「お知らせだけでなく、月額の支払いなど
-- 今後のやり取りも全部、宛先を残す」)。lib/email.ts の sendEmail と lib/line.ts の pushLineMessage で必ず書く。
-- パスワード・確認コード・ログイン情報を含むメールは本文を残さない(sensitive)。運営だけが読める。
create table if not exists public.message_log (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email','line')),
  to_address text not null,
  store_id uuid,
  subject text,
  body text,
  sensitive boolean not null default false,
  has_attachment boolean not null default false,
  status text not null check (status in ('sent','failed','skipped')),
  error text,
  provider_id text,
  created_at timestamptz not null default now()
);
create index if not exists message_log_created_idx on public.message_log (created_at desc);
create index if not exists message_log_to_idx on public.message_log (lower(to_address));
alter table public.message_log enable row level security;
create policy "admin reads message log" on public.message_log for select to authenticated using (public.is_admin());
revoke all on public.message_log from anon, authenticated;
grant select on public.message_log to authenticated;
grant all on public.message_log to service_role;
alter table public.message_log add constraint message_log_store_id_fkey foreign key (store_id) references public.stores(id) on delete set null;
