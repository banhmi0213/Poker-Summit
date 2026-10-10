-- 求人掲載アドオンを追加し、プランの機能説明と上限を揃える。
begin;
update public.plans
set description = replace(description, E'\n求人掲載（3件まで）', ''), job_limit = 0
where tier = 2;
update public.plans
set description = replace(description, E'\n1か月以上の継続で優良店バッジを付与', ''), badge_after_days = null
where tier = 3;
insert into public.addons (code, name, monthly_fee, description, billing_type, capacity, capacity_scope, needs_fulfillment, active, sort_order)
values ('job_listing', '求人掲載1件', 8800, '求人を1件掲載できます。1件につき月額8,800円（税込）。ライト・スタンダードプランでもご利用いただけます。', 'monthly', null, null, false, true, 35)
on conflict (code) where code is not null do update
set name = excluded.name, monthly_fee = excluded.monthly_fee, description = excluded.description,
    billing_type = excluded.billing_type, needs_fulfillment = false, active = true, sort_order = excluded.sort_order;
create or replace function private.active_store_plan(p_store_id uuid)
returns table(plan_id uuid, job_limit integer, spot_monthly_limit integer, list_priority smallint, gold_frame boolean, pickup boolean, badge_after_days integer, contract_started_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.id,
    case when p.job_limit is null then null else p.job_limit + (
      select count(*)::integer from public.store_contract_addons ca
      join public.addons a on a.id = ca.addon_id and a.code = 'job_listing'
      where ca.store_contract_id = c.id
        and (ca.current_period_end is null or ca.current_period_end > now())
        and (ca.pending_removed_at is null or ca.pending_removed_at > now())
    ) end,
    p.spot_monthly_limit, p.list_priority, p.gold_frame, p.pickup, p.badge_after_days, c.created_at
  from public.store_contracts c join public.plans p on p.id = c.plan_id
  where c.store_id = p_store_id and c.status = 'active'
  order by c.created_at desc limit 1
$$;
revoke all on function private.active_store_plan(uuid) from public, anon, authenticated;
create or replace function private.enforce_job_limit()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_has boolean; v_limit integer; v_count integer;
begin
  if new.status is distinct from 'open' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'open' and old.store_id = new.store_id then return new; end if;
  if public.is_admin() then return new; end if;
  select true, ap.job_limit into v_has, v_limit from private.active_store_plan(new.store_id) ap;
  if v_has is null then v_limit := 0; end if;
  if v_limit is null then return new; end if;
  select count(*) into v_count from public.jobs
    where store_id = new.store_id and status = 'open' and id <> new.id;
  if v_count >= v_limit then
    if v_limit = 0 then
      raise exception '求人掲載1件（月額8,800円）のアドオン、またはプレミアムプランでご利用いただけます。';
    end if;
    raise exception '同時に募集できる求人は%件までです。ほかの求人を募集終了にするか、プレミアムプランへの変更をご検討ください。', v_limit;
  end if;
  return new;
end
$$;
revoke all on function private.enforce_job_limit() from public, anon, authenticated;
commit;
