-- カード払いの月額アドオンは、アドオンごとに別のサブスクリプションで課金する(2026/10)。
-- (プランと合わせて決済し直すと、プラン料金を二重に取ってしまうため)
alter table public.store_contract_addons
  add column if not exists fincode_subscription_id text;
