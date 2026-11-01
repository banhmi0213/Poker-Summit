-- 「対応が必要なこと」に、事業者の確認待ちの申し込みを足す(2026/10/21)。
-- 振込は確認待ちの間は請求書を送らない。カードは支払い後すぐ使い始めるので、その日のうちに確認する。
create or replace function public.admin_attention_counts()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare r jsonb;
begin
  if not public.is_admin() then return '{}'::jsonb; end if;
  select jsonb_build_object(
    'listing_applications', (select count(*) from listing_applications where status = 'pending'),
    'kyc_pending', (select count(*) from listing_applications where kyc_status = 'pending' and status <> 'rejected' and payment_status in ('awaiting_review', 'active')),
    'inquiries', (select count(*) from inquiries where status = 'unread'),
    'contracts', (select count(*) from store_contracts c where c.created_at > coalesce(
        (select seen_at from admin_seen where user_id = auth.uid() and section = 'contracts'), now() - interval '7 days')),
    'billing', (select count(*) from invoices where status = 'unpaid'),
    'addon_orders', (select count(*) from addon_orders where status = 'paid'),
    'reports', (select count(*) from reports where status = 'open'),
    'dealer_chat_reports', (select count(*) from dealer_chat_reports where status = 'open'),
    'stores_pending', (select count(*) from stores where status = 'pending')
                      + (select count(*) from store_change_requests where status = 'pending')
  ) into r;
  return r;
end $function$;
