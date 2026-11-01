-- サミットの投稿・返信の作成は会員本人だけ(2026/10/20)。
-- 画面(サーバー側)ではログイン必須にしていたが、データベースの許可が「誰でも作成可」のままで、
-- 公開キーを使えば未ログインでも直接書き込めた(他人の名前・IDも名乗れた)ため塞ぐ。
alter policy "anyone can create posts" on public.board_posts
  with check (auth.uid() is not null and author_user_id = auth.uid());
alter policy "anyone can create replies" on public.board_replies
  with check (auth.uid() is not null and author_user_id = auth.uid());
