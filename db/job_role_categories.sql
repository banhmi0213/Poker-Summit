-- Existing listings are preserved; no guessed classifications are written.
alter table public.jobs add column if not exists job_role text;
comment on column public.jobs.job_role is '店舗が選択する職種。雇用形態job_typeとは分離。';
