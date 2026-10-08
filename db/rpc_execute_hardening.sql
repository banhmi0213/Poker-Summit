-- RPC実行権限の締め直し(2026/10、ローンチ前のセキュリティ確認)
--
-- PostgreSQLは関数を作るとPUBLIC(=anon/authenticatedを含む全員)に実行権限を
-- 付けるため、SECURITY DEFINER関数がすべて /rest/v1/rpc/* から未ログインでも
-- 呼べる状態になっていた。役割ごとに必要な権限だけを付け直す。
--
-- 触らないもの:
--   is_admin() / is_suspended() … RLSポリシー(65か所)から呼ばれるため、
--     anonから外すと未ログインの閲覧が壊れる
--   public_member_count()       … トップページ(未ログイン)で会員数表示に使用
--   get_dealer_reliability / get_matching_dealer_contacts /
--   record_matching_consent / admin_set_store_owner_by_email /
--   system_issue_store_login    … 既にanonから外れている

-- 1) 店舗の契約メール・LINE通知用IDを返す関数。中で認可チェックがないため、
--    サーバー(service_role)からのみ呼べるようにする。
revoke execute on function public.get_job_notification_target(uuid) from public, anon, authenticated;
grant execute on function public.get_job_notification_target(uuid) to service_role;

-- 2) 運営管理用。関数内で is_admin() を確認しているが、未ログインで呼ぶ理由がない。
revoke execute on function public.admin_add_admin_by_email(text, text) from public, anon;
revoke execute on function public.admin_delete_member(uuid) from public, anon;
revoke execute on function public.admin_get_store_login_id(uuid) from public, anon;
revoke execute on function public.admin_issue_store_login(uuid, text, text) from public, anon;
revoke execute on function public.admin_list_members() from public, anon;
revoke execute on function public.admin_list_store_logins() from public, anon;
revoke execute on function public.admin_reissue_store_password(uuid, text) from public, anon;
revoke execute on function public.admin_remove_admin(uuid) from public, anon;
revoke execute on function public.admin_set_admin_active(uuid, boolean) from public, anon;
revoke execute on function public.admin_set_admin_role(uuid, text) from public, anon;
revoke execute on function public.admin_set_member_suspended(uuid, boolean) from public, anon;
grant execute on function public.admin_add_admin_by_email(text, text) to authenticated, service_role;
grant execute on function public.admin_delete_member(uuid) to authenticated, service_role;
grant execute on function public.admin_get_store_login_id(uuid) to authenticated, service_role;
grant execute on function public.admin_issue_store_login(uuid, text, text) to authenticated, service_role;
grant execute on function public.admin_list_members() to authenticated, service_role;
grant execute on function public.admin_list_store_logins() to authenticated, service_role;
grant execute on function public.admin_reissue_store_password(uuid, text) to authenticated, service_role;
grant execute on function public.admin_remove_admin(uuid) to authenticated, service_role;
grant execute on function public.admin_set_admin_active(uuid, boolean) to authenticated, service_role;
grant execute on function public.admin_set_admin_role(uuid, text) to authenticated, service_role;
grant execute on function public.admin_set_member_suspended(uuid, boolean) to authenticated, service_role;

-- 3) ログイン中の会員・店舗オーナー本人用(auth.uid()前提)。未ログインからは外す。
revoke execute on function public.member_delete_self() from public, anon;
revoke execute on function public.use_coupon(uuid) from public, anon;
revoke execute on function public.touch_board_post(uuid) from public, anon;
revoke execute on function public.update_my_store_contact_email(text) from public, anon;
revoke execute on function public.issue_my_store_line_link_code() from public, anon;
revoke execute on function public.mark_job_applications_viewed_for_my_store() from public, anon;
grant execute on function public.member_delete_self() to authenticated, service_role;
grant execute on function public.use_coupon(uuid) to authenticated, service_role;
grant execute on function public.touch_board_post(uuid) to authenticated, service_role;
grant execute on function public.update_my_store_contact_email(text) to authenticated, service_role;
grant execute on function public.issue_my_store_line_link_code() to authenticated, service_role;
grant execute on function public.mark_job_applications_viewed_for_my_store() to authenticated, service_role;

-- 4) NGワード判定。トリガー(関数所有者の権限で実行)からのみ使う。
revoke execute on function public.contains_ng_word(text) from public, anon;
grant execute on function public.contains_ng_word(text) to authenticated, service_role;

-- 5) トリガー関数。トリガー実行時に呼び出し側のEXECUTE権限は確認されないため、
--    直接呼ぶ権限は誰にも不要。
revoke execute on function public.board_posts_ng_filter() from public, anon, authenticated;
revoke execute on function public.board_replies_ng_filter() from public, anon, authenticated;
revoke execute on function public.sync_store_email_from_contract() from public, anon, authenticated;

-- 6) search_path未固定の警告対応
alter function public.set_updated_at() set search_path = public;
