-- 初回の申込みはKOMOJUの支払い画面でカード登録と支払いを同時に行うため、
-- 支払いの記録を作る時点ではカード(customer)がまだ無い(2026/10/19)
alter table public.payment_attempts alter column customer_id drop not null;
