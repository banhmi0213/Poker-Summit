import { cookies } from "next/headers";

/** ブラウザごとのランダムな閲覧者番号(UUを数えるため。middleware が ps_vid Cookie に入れる、2026/10/21) */
export const VISITOR_COOKIE = "ps_vid";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getVisitorId(): string | null {
  try {
    const v = cookies().get(VISITOR_COOKIE)?.value ?? "";
    return UUID_RE.test(v) ? v : null;
  } catch {
    return null;
  }
}
