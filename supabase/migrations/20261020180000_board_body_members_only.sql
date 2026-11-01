-- サミットの本文・返信の中身は会員だけが読める(2026/10/20 オーナー指示「スレ立て・返信・観覧は会員のみ。一覧は見せたまま」)。
-- 未ログイン(anon)には、一覧に出すタイトル・投稿者名・カテゴリ・日付・返信数に要る列だけを読ませる。
revoke select on public.board_posts from anon;
grant select (id, author_user_id, author_name, title, status, created_at, updated_at, category) on public.board_posts to anon;
revoke select on public.board_replies from anon;
grant select (id, post_id, author_user_id, author_name, status, created_at) on public.board_replies to anon;
