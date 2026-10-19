-- 1つの m HOLD'EM ID は1アカウントだけ(2026/10/19、ユーザー指示)。大文字・小文字は同じとみなす
create unique index if not exists member_m_holdem_ids_unique_id on public.member_m_holdem_ids (lower(m_holdem_id));

create or replace function private.capture_m_holdem_id_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v text := nullif(btrim(new.raw_user_meta_data->>'m_holdem_id'), '');
begin
  if v is not null and v !~ '\s' and char_length(v) <= 64 then
    begin
      insert into public.member_m_holdem_ids (user_id, m_holdem_id) values (new.id, v) on conflict (user_id) do nothing;
    exception when unique_violation then
      null; -- 同時登録の競合時は保存しない(会員登録自体は止めない)
    end;
  end if;
  return new;
end;
$$;

create or replace function public.set_my_m_holdem_id(p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v text := btrim(coalesce(p_id, ''));
begin
  if auth.uid() is null then raise exception 'ログインしてください。'; end if;
  if v = '' then return; end if;
  if v ~ '\s' or char_length(v) > 64 then raise exception 'm HOLD''EM IDは空白を含めず、64文字以内で入力してください。'; end if;
  if exists (select 1 from public.member_m_holdem_ids where user_id = auth.uid()) then
    raise exception 'm HOLD''EM IDは登録後に変更できません。変更が必要な場合はお問い合わせください。';
  end if;
  begin
    insert into public.member_m_holdem_ids (user_id, m_holdem_id) values (auth.uid(), v);
  exception when unique_violation then
    raise exception 'このm HOLD''EM IDはすでに別のアカウントで登録されています。ご自身のIDの場合はお問い合わせください。';
  end;
end;
$$;

create or replace function public.admin_set_member_m_holdem_id(p_user_id uuid, p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v text := btrim(coalesce(p_id, ''));
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if v = '' then
    delete from public.member_m_holdem_ids where user_id = p_user_id;
    return;
  end if;
  if v ~ '\s' or char_length(v) > 64 then raise exception 'm HOLD''EM IDは空白を含めず、64文字以内で入力してください。'; end if;
  begin
    insert into public.member_m_holdem_ids (user_id, m_holdem_id, updated_by) values (p_user_id, v, auth.uid())
    on conflict (user_id) do update set m_holdem_id = excluded.m_holdem_id, updated_at = now(), updated_by = auth.uid();
  exception when unique_violation then
    raise exception 'このm HOLD''EM IDは別の会員が登録しています。先にその会員のIDを消してください。';
  end;
end;
$$;

-- 会員登録の前に、IDがすでに使われていないか確かめる(service_role のみ。外から使われ具合を調べられないように)
create or replace function public.m_holdem_id_taken(p_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.member_m_holdem_ids where lower(m_holdem_id) = lower(btrim(coalesce(p_id, ''))));
$$;
revoke all on function public.m_holdem_id_taken(text) from public, anon, authenticated;
grant execute on function public.m_holdem_id_taken(text) to service_role;
