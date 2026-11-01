-- スポット求人の勤務日は今日以降ならいつでも(2026/10/22 オーナー指示)。回数は勤務日1日で1回のまま。
create or replace function private.enforce_spot_shift_window()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_today date := (now() at time zone 'Asia/Tokyo')::date; j record;
begin
  if public.is_admin() then return new; end if;
  select id, store_id, published, scout_only into j from public.spot_jobs where id = new.job_id;
  if not found or not j.published or j.scout_only then return new; end if;
  if new.work_date < v_today then
    raise exception '過ぎた日は公開できません。今日以降の勤務日を選んでください。';
  end if;
  perform private.use_spot_day(j.id, j.store_id, new.work_date);
  return new;
end $$;
