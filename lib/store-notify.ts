// 店舗の「応募・チャットのお知らせ」の受け取り方(2026/10)。
// 選んだ方が使えない(LINE未連携・メール未登録)ときは、もう一方で必ず届ける。
export type NotifyChannel = "both" | "line" | "email";

export function storeNotifyTargets(pref: string | null | undefined, hasLine: boolean, hasEmail: boolean) {
  const p: NotifyChannel = pref === "line" || pref === "email" ? pref : "both";
  let line = hasLine && p !== "email";
  let email = hasEmail && p !== "line";
  if (!line && !email) {
    line = hasLine;
    email = hasEmail;
  }
  return { line, email };
}
