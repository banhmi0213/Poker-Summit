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

/** 運営の端末か(総合管理を開いたことがある端末。閲覧数に数えない、2026/10/21) */
export function isStaffDevice(): boolean {
  try {
    return cookies().get("ps_staff")?.value === "1";
  } catch {
    return false;
  }
}
