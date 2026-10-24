-- Database default grants may include write/TRUNCATE privileges. Limit these explicitly.
revoke all on public.poker_news from anon, authenticated;
grant select on public.poker_news to anon;
grant select,insert,update,delete on public.poker_news to authenticated;
