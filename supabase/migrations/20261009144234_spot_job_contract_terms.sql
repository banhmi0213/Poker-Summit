alter table public.spot_jobs
 add column contract_type text check(contract_type in ('employment','contract')),
 add column payment_method text check(payment_method in ('bank','cash')),
 add column payment_date text check(length(payment_date) between 1 and 100),
 add column contract_notes text check(length(contract_notes) between 1 and 2000);

create function public.save_spot_job_with_terms(p_id uuid,p_store_id uuid,p_games text[],p_duties text,p_requirements text,p_transport_type text,p_transport_limit integer,p_dress text,p_deadline timestamptz,p_image text,p_published boolean,p_shifts jsonb,p_terms jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
 if p_terms is null or coalesce(p_terms->>'contract_type','') not in ('employment','contract') or coalesce(p_terms->>'payment_method','') not in ('bank','cash') or length(trim(coalesce(p_terms->>'payment_date',''))) not between 1 and 100 or length(trim(coalesce(p_terms->>'notes',''))) not between 1 and 2000 then raise exception '契約形態・支払方法・支払日・その他の合意事項を入力してください。'; end if;
 v_id:=public.save_spot_job(p_id,p_store_id,p_games,p_duties,p_requirements,p_transport_type,p_transport_limit,p_dress,p_deadline,p_image,p_published,p_shifts);
 update public.spot_jobs set contract_type=p_terms->>'contract_type',payment_method=p_terms->>'payment_method',payment_date=trim(p_terms->>'payment_date'),contract_notes=trim(p_terms->>'notes') where id=v_id and store_id=p_store_id;
 if not found then raise exception '保存できません。'; end if;
 return v_id;
end $$;
revoke all on function public.save_spot_job_with_terms(uuid,uuid,text[],text,text,text,integer,text,timestamptz,text,boolean,jsonb,jsonb) from public,anon;
grant execute on function public.save_spot_job_with_terms(uuid,uuid,text[],text,text,text,integer,text,timestamptz,text,boolean,jsonb,jsonb) to authenticated;

-- Seed the terms atomically for both dealer applications and store offers.
-- Existing rooms and their agreed revisions are never rewritten.
create function private.seed_spot_chat_terms() returns trigger language plpgsql security definer set search_path='' as $$
declare j public.spot_jobs; owner uuid;
begin
 if new.spot_job_id is null then return new; end if;
 select * into j from public.spot_jobs where id=new.spot_job_id and store_id=new.store_id;
 if j.contract_type is null or j.payment_method is null or j.payment_date is null or j.contract_notes is null then return new; end if;
 select owner_user_id into owner from public.stores where id=new.store_id;
 if owner is null then return new; end if;
 insert into public.dealer_chat_terms(record_id,revision,contract_type,payment_method,payment_date,notes,updated_by)
 values(new.id,1,j.contract_type,j.payment_method,j.payment_date,j.contract_notes,owner) on conflict(record_id) do nothing;
 return new;
end $$;
revoke all on function private.seed_spot_chat_terms() from public,anon,authenticated;
create trigger seed_spot_chat_terms after insert on public.dealer_matching_records for each row execute function private.seed_spot_chat_terms();
