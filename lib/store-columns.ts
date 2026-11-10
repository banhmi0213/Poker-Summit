// 店舗の表で、ログインしていない人(anon)にも読ませる列(2026/11/10 オーナー：店舗情報が抜かれまくっている)。
// 持ち主のID・LINEの通知先・営業メールの可否・Googleの照合メモ・画像の保存場所などは、データベース側でも anon から読めないようにしている
// (supabase/migrations/20261110120000_stores_anon_columns.sql)。公開ページで stores を読むときは select("*") ではなくこの列を使う。
export const STORE_PUBLIC_COLUMNS =
  "id,name,category,region,pref,city,address,tel,hours,description,status,created_at,updated_at,line_url,area_keywords,is_recommended,lat,lng,logo_url,google_place_id,nearest_station,email,x_url,instagram_url,banner_url,is_national_pickup,google_hours_text,google_hours_periods,google_hours_fetched_at";
