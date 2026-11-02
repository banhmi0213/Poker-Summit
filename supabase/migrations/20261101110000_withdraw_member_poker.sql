-- 退会とポーカーの記録(2026/11/01)。
-- 1) 大会の自動参加リスト(poker_private.entry_targets)が会員の削除を止める設定になっていて、そこに載っている会員は
--    退会がエラーになっていた。退会時にその会員の行を先に消す。
-- 2) 匿名化で退会する会員(ディーラーの記録などが残る人)は会員データが消えないので、外部キーの自動削除が働かない。
--    GTOの記録(GTOチャットのテーブル)と、HUDのメモ(書いたもの・書かれたもの)をここで消す。
--    リングのチップの帳簿・ハンドの記録は会員IDだけで個人情報を持たないので、帳簿として残す。
-- 本体は本番の private.withdraw_member をそのまま引き継ぎ、上の処理だけ足している(検証DBには元の関数がないので新規作成になる)。
create schema if not exists private;
create or replace function private.withdraw_member(p_uid uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_has_records boolean;
begin
  -- Poker: rows that would block deleting the member, and private notes/records that must go in either case.
  if to_regclass('poker_private.entry_targets') is not null then
    execute 'delete from poker_private.entry_targets where member_id = $1' using p_uid;
  end if;
  if to_regclass('poker_private.member_notes') is not null then
    execute 'delete from poker_private.member_notes where owner_id = $1 or target_id = $1' using p_uid;
  end if;
  if to_regclass('public.poker_gto_decisions') is not null then
    execute 'delete from public.poker_gto_decisions where member_id = $1' using p_uid;
  end if;
  if to_regclass('public.poker_gto_practice_hands') is not null then
    execute 'delete from public.poker_gto_practice_hands where member_id = $1' using p_uid;
  end if;

  v_has_records :=
    exists (select 1 from public.dealer_matching_records where dealer_user_id = p_uid or verified_by = p_uid)
    or exists (select 1 from public.dealer_chat_consents where user_id = p_uid)
    or exists (select 1 from public.dealer_chat_messages where sender_id = p_uid)
    or exists (select 1 from public.dealer_chat_blocks where user_id = p_uid)
    or exists (select 1 from public.dealer_chat_reports where reporter_id = p_uid or resolved_by = p_uid)
    or exists (select 1 from public.matching_notifications where recipient_id = p_uid or sender_id = p_uid)
    or exists (select 1 from public.dealer_chat_terms where updated_by = p_uid)
    or exists (select 1 from public.store_change_requests where reviewed_by = p_uid);

  if not v_has_records then
    delete from auth.users where id = p_uid;
    return;
  end if;

  delete from public.profiles where user_id = p_uid;
  delete from public.dealer_addresses where user_id = p_uid;
  delete from public.dealer_private_contacts where user_id = p_uid;
  delete from public.favorite_stores where user_id = p_uid;
  delete from public.favorite_jobs where user_id = p_uid;
  delete from public.favorite_coupons where user_id = p_uid;
  delete from public.favorite_events where user_id = p_uid;
  delete from public.event_participants where user_id = p_uid;
  delete from public.academy_graduation where user_id = p_uid;
  delete from public.admin_seen where user_id = p_uid;
  update public.dealer_profiles
     set full_name = '退会済みのディーラー', appeal = '', photo_url = null, published = false, updated_at = now()
   where user_id = p_uid;

  delete from auth.identities where user_id = p_uid;
  delete from auth.sessions where user_id = p_uid;
  delete from auth.one_time_tokens where user_id = p_uid;
  update auth.users
     set email = 'withdrawn+' || p_uid::text || '@withdrawn.invalid',
         phone = null,
         encrypted_password = '',
         email_change = '', email_change_token_new = '', email_change_token_current = '',
         confirmation_token = '', recovery_token = '', reauthentication_token = '',
         raw_user_meta_data = jsonb_build_object('withdrawn_at', now()),
         banned_until = 'infinity',
         updated_at = now()
   where id = p_uid;
end;
$function$;
revoke all on function private.withdraw_member(uuid) from public,anon,authenticated;
