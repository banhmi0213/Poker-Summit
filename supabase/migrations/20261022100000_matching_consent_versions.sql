-- マッチングの同意の版ずれを直す(2026/10/22)。
-- 同意画面は 2026-10-09 版で記録している(public.record_matching_consent / lib/legal.ts)のに、
-- 応募・オファー・チャット・確定・キャンセルなどの関数は 2026-10-07 版しか見ていなかったため、
-- 10/09以降に同意した会員・店舗が「規約に同意してください」で止まっていた。2026-10-07 と 2026-10-09 の両方を有効にする。
do $$
declare f record; def text; old_txt text := 'terms_version=''2026-10-07'' and privacy_version=''2026-10-07'' and rules_version=''2026-10-07''';
  new_txt text := 'terms_version in (''2026-10-07'',''2026-10-09'') and privacy_version in (''2026-10-07'',''2026-10-09'') and rules_version in (''2026-10-07'',''2026-10-09'')';
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname in ('public','private') and p.prosrc like '%' || old_txt || '%' loop
    def := pg_get_functiondef(f.oid);
    execute replace(def, old_txt, new_txt);
  end loop;
end $$;
