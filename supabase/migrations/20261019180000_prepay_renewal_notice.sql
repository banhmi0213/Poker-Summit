-- カードのまとめ払い(6か月・12か月)の自動更新の事前お知らせを、どの期間の分まで送ったか(2026/10/19)
alter table public.store_contracts add column if not exists renewal_notice_for timestamptz;
