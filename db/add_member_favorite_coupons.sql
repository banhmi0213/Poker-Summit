create table public.favorite_coupons (
 user_id uuid not null references auth.users(id) on delete cascade,
 coupon_id uuid not null references public.coupons(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,coupon_id)
);
create index favorite_coupons_coupon_idx on public.favorite_coupons(coupon_id);
alter table public.favorite_coupons enable row level security;
revoke all on public.favorite_coupons from anon, authenticated;
grant select, insert, delete on public.favorite_coupons to authenticated;
create policy favorite_coupons_read_own on public.favorite_coupons for select to authenticated using ((select auth.uid())=user_id);
create policy favorite_coupons_save_own on public.favorite_coupons for insert to authenticated with check ((select auth.uid())=user_id);
create policy favorite_coupons_remove_own on public.favorite_coupons for delete to authenticated using ((select auth.uid())=user_id);