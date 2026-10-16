import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { STORE_AUTH_COOKIE_NAME } from "@/lib/constants";

// 会員・総合管理画面(デフォルトCookie)と店舗管理画面(STORE_AUTH_COOKIE_NAME、
// lib/supabase/store-server.ts参照)は別々のCookieにセッションを持つため、
// このmiddlewareでも2つのSupabaseクライアントを使い分ける(2026/09/30、
// 「シークレットとかじゃなしに両方はいれるようにして」との指示)。
//
// 2クライアント分のCookie更新を1つのNextResponseにまとめて反映する必要が
// あるため、setAllでは各クライアントが個別にレスポンスを作り直すのでは
// なく、更新分をpendingCookiesに集約しておき、最後に1回だけ適用する
// (個別にNextResponse.next()を作り直すと、先に反映したクライアントの
// Set-Cookieが後から上書きされて消えてしまうバグになる)。
export async function updateSession(request: NextRequest) {
  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = [];

  function makeClient(cookieName?: string) {
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        ...(cookieName ? { cookieOptions: { name: cookieName } } : {}),
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            pendingCookies.push(...cookiesToSet);
          },
        },
      }
    );
  }

  const pathname = request.nextUrl.pathname;

  // 店舗管理(/store/*)配下は、未ログイン時の行き先を会員ログイン(/login,
  // メールアドレス)ではなく専用の店舗ログイン画面(/store/login,
  // ログインID)にする(2026/09/30、会員と店舗の入口を分離)。
  // /store/login自体は未ログインでもアクセスできる必要があるので、
  // ここでガード対象から除外する(含めると自分自身へのリダイレクトが
  // 無限ループする)。
  const isStorePath = pathname.startsWith("/store/") && pathname !== "/store/login";
  const isStoreScope = isStorePath || pathname === "/store/login";

  // 総合管理画面(/admin配下)も同様に、未ログイン時は専用の管理ログイン
  // 画面(/admin-login)へ飛ばす(2026/10、「adminは専用のログイン画面
  // 作って」との指示)。"/admin"始まりの文字列一致だと"/admin-login"自体も
  // ここに含まれてしまい、未ログイン→/admin-loginへリダイレクト→
  // /admin-login自体もこの条件に一致して再度リダイレクト…という無限ループ
  // になるため、"/admin"完全一致 または "/admin/"始まりだけを対象にし、
  // "/admin-login"はこの判定に含めない(/store/loginの除外と同じ考え方)。
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");

  // /store/* 配下は店舗用Cookieだけを見る(会員セッションの有無は無関係)。
  // それ以外(会員・管理者向けの/admin, /mypage, /account等)はデフォルトの
  // Cookieだけを見る。片方のセッション有無がもう片方の判定に影響しない
  // ようにするのがポイント。
  const supabase = makeClient(isStoreScope ? STORE_AUTH_COOKIE_NAME : undefined);

  const isProtectedPath =
    isAdminPath || isStorePath || pathname.startsWith("/mypage") || pathname.startsWith("/account");

  const maintenanceExempt =
    isAdminPath ||
    pathname === "/admin-login" ||
    pathname.startsWith("/store/") ||
    pathname === "/login" ||
    pathname === "/maintenance" ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/go/");

  // ログイン必須のページだけ、認証サーバーに問い合わせてログイン状態を確かめる(getUser)。
  // 一般公開のページでは、Cookie内のセッションの期限切れ更新だけを行う(getSession。
  // 期限内なら通信なし)。ページ側のログイン判定は各ページの getUser で行うので、
  // ここで毎回認証サーバーへ問い合わせる必要はない(2026/10、表示速度対策)。
  // メンテナンスモードの確認もこれと同時に行う。
  const [user, flags] = await Promise.all([
    isProtectedPath
      ? supabase.auth.getUser().then(({ data }) => data.user)
      : // session.user には触らない(サーバー側で触ると supabase-js が毎回警告を出すため)
        supabase.auth.getSession().then(() => null),
    getSiteFlags(),
  ]);
  const maintenanceMode = !maintenanceExempt && flags.maintenance;

  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = isStorePath ? "/store/login" : isAdminPath ? "/admin-login" : "/login";
    url.searchParams.set("next", pathname);
    const response = NextResponse.redirect(url);
    pendingCookies.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options)
    );
    return response;
  }

  let response = NextResponse.next({ request });

  if (maintenanceMode) {
    const url = request.nextUrl.clone();
    url.pathname = "/maintenance";
    response = NextResponse.rewrite(url);
  } else if (flags.prelaunch && !isPrelaunchExempt(pathname) && !(hasMemberSessionCookie(request) && (await isAdminSession(supabase)))) {
    // 先行登録モード(2026/10): 一般向けページは先行会員登録の案内ページに差し替える。
    // トップ(/)は検索結果に案内ページが出るよう通常の200で返し、それ以外のページは
    // 「一時的に閉じている」ことを検索エンジンに伝えるため 503 + Retry-After で返す
    // (ローンチ後に元の評価のまま戻すため。noindex にはしない)。
    const url = request.nextUrl.clone();
    url.pathname = "/prelaunch";
    url.search = "";
    response =
      pathname === "/"
        ? NextResponse.rewrite(url, { request })
        : NextResponse.rewrite(url, { request, status: 503, headers: { "Retry-After": "86400" } });
  }

  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );

  return response;
}

// メンテナンスモード・先行登録モードのON/OFFは、同じサーバーの中で30秒だけ覚えておく
// (全ページの表示のたびにデータベースへ問い合わせないため。切り替えの反映は最大30秒遅れる)
let flagsCache: { value: { maintenance: boolean; prelaunch: boolean }; at: number } | null = null;
async function getSiteFlags(): Promise<{ maintenance: boolean; prelaunch: boolean }> {
  if (flagsCache && Date.now() - flagsCache.at < 30_000) return flagsCache.value;
  // ログイン状態に関係ない設定なので、Cookieなしのクライアントで読む
  // (期限切れのログイン情報で問い合わせて失敗するのを避ける)
  const anon = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
  const { data: settings, error } = await anon
    .from("site_settings")
    .select("maintenance_mode, prelaunch_mode")
    .eq("id", true)
    .maybeSingle();
  if (error) return flagsCache?.value ?? { maintenance: false, prelaunch: false };
  const value = { maintenance: !!settings?.maintenance_mode, prelaunch: !!settings?.prelaunch_mode };
  flagsCache = { value, at: Date.now() };
  return value;
}

/** 先行登録モード中も開けるページ(運営・店舗管理・会員登録/ログイン・規約類・API等) */
function isPrelaunchExempt(pathname: string) {
  const exact = ["/prelaunch", "/maintenance", "/login", "/login/forgot", "/admin-login", "/terms", "/privacy", "/tokushoho", "/disclaimer", "/company", "/robots.txt", "/sitemap.xml"];
  if (exact.includes(pathname)) return true;
  const prefixes = ["/admin/", "/store/", "/signup", "/auth/", "/api/", "/apply", "/contact", "/liff", "/go/", "/account/password", "/account/dealer", "/_next/"];
  return pathname === "/admin" || prefixes.some((p) => pathname.startsWith(p));
}

/** 会員(運営含む)のログインCookieがあるか。無ければ運営チェックの問い合わせを省く */
function hasMemberSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token") && !c.name.startsWith(STORE_AUTH_COOKIE_NAME));
}

/** 運営としてログインしているか(先行登録モード中も運営はサイト全体を確認できるようにする) */
async function isAdminSession(supabase: ReturnType<typeof createServerClient>) {
  try {
    const { data } = await supabase.rpc("is_admin");
    return data === true;
  } catch {
    return false;
  }
}
