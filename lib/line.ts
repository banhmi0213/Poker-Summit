// LINE ID token verification for the LIFF (LINE mini-app) API routes.
//
// The LIFF frontend calls `liff.getIDToken()` and sends that token to our
// API routes. We never trust it as-is — every route under app/api/liff/*
// must call `verifyLiffIdToken` first and use the returned `userId` (LINE's
// `sub` claim) to look up `stores.line_user_id`. This mirrors how the web
// portal trusts `supabase.auth.getUser()` rather than a client-supplied id.
//
// Verification is delegated to LINE's own /oauth2/v2.1/verify endpoint
// (recommended by LINE's docs for server-side verification without needing
// to fetch/cache LINE's JWKS ourselves).
const LINE_VERIFY_ENDPOINT = "https://api.line.me/oauth2/v2.1/verify";

type LineVerifyResponse = {
  iss: string;
  sub: string; // LINE userId
  aud: string; // LIFF channel id
  exp: number;
  iat: number;
  name?: string;
  picture?: string;
};

export type LineIdTokenResult =
  | { userId: string; name?: string; picture?: string; error?: undefined }
  | { userId?: undefined; error: string };

export async function verifyLiffIdToken(idToken: string): Promise<LineIdTokenResult> {
  const channelId = process.env.LINE_CHANNEL_ID;
  if (!channelId) {
    return { error: "LINE_CHANNEL_ID が設定されていません。" };
  }
  if (!idToken || typeof idToken !== "string") {
    return { error: "IDトークンがありません。" };
  }

  let res: Response;
  try {
    res = await fetch(LINE_VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }).toString(),
      cache: "no-store",
    });
  } catch {
    return { error: "LINEの認証確認サーバーに接続できませんでした。" };
  }

  if (!res.ok) {
    // LINE returns 400 with { error, error_description } for an
    // expired/invalid/wrong-audience token — never leak the raw body back
    // to the client, just refuse.
    return { error: "IDトークンの検証に失敗しました。もう一度LINEアプリから開き直してください。" };
  }

  let payload: LineVerifyResponse;
  try {
    payload = await res.json();
  } catch {
    return { error: "LINEの認証確認レスポンスを読み取れませんでした。" };
  }

  if (payload.aud !== channelId) {
    return { error: "IDトークンの発行元チャネルが一致しません。" };
  }
  if (payload.iss !== "https://access.line.me") {
    return { error: "IDトークンの発行者が不正です。" };
  }
  if (!payload.sub) {
    return { error: "IDトークンにユーザーIDが含まれていません。" };
  }
  // `exp` is in seconds since epoch; LINE also checks this server-side, but
  // we don't rely solely on that in case of clock/proxy weirdness.
  if (payload.exp * 1000 < Date.now()) {
    return { error: "IDトークンの有効期限が切れています。" };
  }

  return { userId: payload.sub, name: payload.name, picture: payload.picture };
}

// ---------------------------------------------------------------------------
// Messaging API — used to push a notice to a store's linked LINE account
// (e.g. "your name/address change was approved"). Optional/best-effort: a
// failure here should never block the underlying data change.
// ---------------------------------------------------------------------------
/**
 * そのLINEユーザーが公式アカウント(Messaging API のチャネル)を友だち追加しているか。
 * 友だちでない(またはブロック中)ならプロフィールAPIが404を返すのを利用する。わからないときは null。
 */
export async function isLineFriend(lineUserId: string): Promise<boolean | null> {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken || !lineUserId) return null;
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(lineUserId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return true;
    if (res.status === 404) return false;
    return null;
  } catch {
    return null;
  }
}

export async function pushLineMessage(lineUserId: string, text: string, meta: { storeId?: string | null } = {}): Promise<void> {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken || !lineUserId) return;
  const body = text.slice(0, 4900);
  // 送ったLINEも記録に残す(public.message_log、2026/10/20)
  const { logMessage } = await import("@/lib/message-log");

  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: "text", text: body }],
      }),
    });
    await logMessage({
      channel: "line",
      to: lineUserId,
      body,
      storeId: meta.storeId ?? null,
      status: res.ok ? "sent" : "failed",
      error: res.ok ? null : `LINE API error (${res.status}): ${(await res.text().catch(() => "")).slice(0, 300)}`,
    });
  } catch (e) {
    await logMessage({ channel: "line", to: lineUserId, body, storeId: meta.storeId ?? null, status: "failed", error: e instanceof Error ? e.message : String(e) });
    // Best-effort notification only — never throw from here.
  }
}
