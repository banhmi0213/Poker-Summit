-- billing_events.source に 'contract_change'(店舗が管理画面で行ったプラン変更の即時決済)を追加。
-- これまで制約に無かったため、プラン変更時の決済記録が保存されていなかった(2026/10)。
alter table public.billing_events drop constraint if exists billing_events_source_check;
alter table public.billing_events add constraint billing_events_source_check
  check (source in ('manual', 'fincode_webhook', 'bank_transfer', 'contract_change'));
