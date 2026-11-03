-- 表記統一（オーナー 2026/11/03）：「卓」ではなく「テーブル」。
-- 画面に出るデータ（チップ交換の商品名・説明、リングのテーブル名・メモ）も言い換える。
update poker_private.shop_items
   set label = replace(label, '卓', 'テーブル'),
       description = replace(description, '卓', 'テーブル')
 where label like '%卓%' or description like '%卓%';

update public.poker_ring_tables
   set title = replace(title, '卓', 'テーブル'),
       note = replace(note, '卓', 'テーブル')
 where title like '%卓%' or note like '%卓%';
