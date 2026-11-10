-- 店舗の表を、ログインしていない人(anon)から丸ごと読めないようにする(オーナー 2026/11/10：店舗情報が抜かれまくっている)。
-- 公開用の鍵で REST から全列(持ち主のID・LINEの通知先・営業メールの可否など)が読めていたため、anon は公開ページで使う列だけにする。
-- 公開ページの読み込みは lib/store-columns.ts の STORE_PUBLIC_COLUMNS を使う(select("*") は anon では失敗する)。
revoke select on public.stores from anon;
grant select (id,name,category,region,pref,city,address,tel,hours,description,status,created_at,updated_at,line_url,area_keywords,is_recommended,lat,lng,logo_url,google_place_id,nearest_station,email,x_url,instagram_url,banner_url,is_national_pickup,google_hours_text,google_hours_periods,google_hours_fetched_at) on public.stores to anon;
