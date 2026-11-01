/** Native mobile copy uses the original high-resolution photo assets. */
export function mobileSectionBanner(image: string) {
  const file = image.split("/").pop() ?? "";
  if (!image.startsWith("/images/")) return null;
  if (/^jobs-banner-light-v\d+\.(webp|png)$/.test(file)) return {title:"新着求人・スポット求人",description:"ポーカーが好き その気持ちが仕事のきっかけに",photo:"/images/mobile-careers.webp"};
  if (/^coupon-banner-light-v\d+\.webp$/.test(file)) return {title:"クーポンを探す",description:"お得な特典をチェック",photo:"/images/mobile-coupons.webp"};
  if (/^(events|tournament)-banner-light-v\d+\.webp$/.test(file)) return {title:"トーナメント・イベント",description:"次の挑戦を見つけよう",photo:"/images/mobile-events.webp"};
  if (/^summit-banner-light-v\d+\.webp$/.test(file)) return {title:"サミット｜情報交換",description:"ポーカー仲間とつながる・質問する・情報を共有する",photo:"/images/mobile-community.webp"};
  if (/^store-banner-light-v\d+\.webp$/.test(file)) return {title:"ポーカー店舗を探す",description:"お気に入りのポーカースポットを見つけよう",photo:"/images/mobile-stores.webp"};
  if (/^ranking-banner-light-v\d+\.webp$/.test(file)) return {title:"店舗ランキング",description:"人気のポーカースポットをチェック",photo:"/images/mobile-stores.webp"};
  if (/^poker-news-banner\.webp$/.test(file)) return {title:"ポーカーニュース",description:"最新のポーカー情報をチェック",photo:"/images/mobile-news.webp"};
  return null;
}
