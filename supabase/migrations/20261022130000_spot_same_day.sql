-- スポット求人は勤務日の当日(日本時間で日付が変わってから)だけディーラーに表示・応募できる(2026/10/22 オーナー指示)。
-- 店はいつでも先の日の分まで設定でき、回数は勤務日1日で1回。店本人と運営には全部の日が見える。
do $$ begin
  if not exists (select 1 from pg_policies where tablename='spot_job_shifts' and policyname='spot_shift_same_day') then
    create policy spot_shift_same_day on public.spot_job_shifts as restrictive for select using (
      work_date = (now() at time zone 'Asia/Tokyo')::date
      or public.is_admin()
      or exists (select 1 from public.spot_jobs j join public.stores s on s.id = j.store_id where j.id = spot_job_shifts.job_id and s.owner_user_id = (select auth.uid()))
    );
  end if;
end $$;

-- 応募も当日の分だけ
do $$ declare def text;
begin
  def := pg_get_functiondef('private.request_spot_work'::regproc);
  if position('応募できるのは勤務日の当日' in def) = 0 then
    def := replace(def, 'if not found then raise exception ''勤務日がありません。''; end if;',
      'if not found then raise exception ''勤務日がありません。''; end if;' || E'\n' || ' if s.work_date <> (now() at time zone ''Asia/Tokyo'')::date then raise exception ''応募できるのは勤務日の当日です。''; end if;');
    execute def;
  end if;
end $$;
