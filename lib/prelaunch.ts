// 先行会員限定トーナメントの案内(2026/10/19、ユーザー指示)。先行登録ページに表示する
export const PRELAUNCH_TOURNAMENT = {
  dateLabel: "10/25（日）21:00",
  prizeLabel: "総額3万円保証",
};

// 正式オープン日と、会員になると使える機能(2026/10/19、ユーザー指示)
export const PRELAUNCH_LAUNCH_LABEL = "10/25（日）正式オープン";
export const PRELAUNCH_FEATURES = ["全国のポーカー店検索", "求人・ディーラー登録", "サミット（掲示板）"];

// クーポン・イベント・求人が0件のときに「正式オープンから順次掲載」と添える期間(2026/10/20、ユーザー指示)。
// 先行公開中とオープン直後は、空っぽの理由が分かるようにする。11月に入ったら出さない。
const OPENING_NOTE_UNTIL = Date.parse("2026-11-01T00:00:00+09:00");
export function openingEmptyNote(what: string): string | null {
  if (Date.now() >= OPENING_NOTE_UNTIL) return null;
  return `10/25（日）の正式オープンから、全国の店舗の${what}を順次掲載していきます。`;
}
