-- サミット(掲示板)で「運営」バッジを付ける運営アカウント(2026/10/20 オーナー指示:
-- オーナー個人のアカウントではなく、もう1つの運営アカウントにだけ付ける)。
alter table public.admin_users add column if not exists board_official boolean not null default false;
update public.admin_users set board_official = true where user_id = '9c6aa64d-67a6-48fe-8a7d-2edcd867edb4';

-- 掲示板の表示用: 渡した投稿者のうち「運営」バッジを付けるアカウント(誰でも呼べる。ID以外は返さない)
create or replace function public.official_board_user_ids(p_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.user_id from public.admin_users a
  where a.board_official and a.active and a.user_id = any(p_ids);
$$;
revoke all on function public.official_board_user_ids(uuid[]) from public;
grant execute on function public.official_board_user_ids(uuid[]) to anon, authenticated, service_role;
