// 先行会員限定トーナメントの案内(2026/10/19、ユーザー指示)。先行登録ページに表示する
export const PRELAUNCH_TOURNAMENT = {
  dateLabel: "10/25（日）21:00",
  prizeLabel: "総額3万円保証",
};

// 限定フリーロールには、10/25（日）20:00までに会員登録した人が参加できる(2026/10/21、一般公開に合わせてオーナー指示)。
// 案内は大会の開始(10/25 21:00)まで出す。
const FREEROLL_SIGNUP_UNTIL = Date.parse("2026-10-25T20:00:00+09:00");
export const FREEROLL_ELIGIBILITY = "10/25（日）20:00までに会員登録した方";
export function freerollSignupOpen(): boolean {
  return Date.now() < FREEROLL_SIGNUP_UNTIL;
}

// 正式オープン日と、会員になると使える機能(2026/10/19、ユーザー指示)
export const PRELAUNCH_LAUNCH_LABEL = "10/25（日）正式オープン";
// 2026/10/20: 先行会員に今すぐ見られるものだけにする(求人はまだ0件のため外す)
export const PRELAUNCH_FEATURES = ["全国780店舗以上のポーカー店検索", "サミット（掲示板）", "国内外の大型大会情報"];

// クーポン・イベント・求人が0件のときに「正式オープンから順次掲載」と添える期間(2026/10/20、ユーザー指示)。
// 先行公開中とオープン直後は、空っぽの理由が分かるようにする。11月に入ったら出さない。
const OPENING_NOTE_UNTIL = Date.parse("2026-11-01T00:00:00+09:00");
export function openingEmptyNote(what: string): string | null {
  if (Date.now() >= OPENING_NOTE_UNTIL) return null;
  return `10/25（日）の正式オープンから、全国の店舗の${what}を順次掲載していきます。`;
}

/** 先行登録モードが今効いているか(prelaunch_ends_at を過ぎたら自動で終わり、2026/10/20) */
export function isPrelaunchActive(row: { prelaunch_mode?: boolean | null; prelaunch_ends_at?: string | null } | null | undefined): boolean {
  if (!row?.prelaunch_mode) return false;
  if (row.prelaunch_ends_at && Date.now() >= Date.parse(row.prelaunch_ends_at)) return false;
  return true;
}
