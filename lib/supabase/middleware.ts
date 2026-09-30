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

  // /store/* 配下は店舗用Cookieだけを見る(会員セッションの有無は無関係)。
  // それ以外(会員・管理者向けの/admin, /mypage, /account等)はデフォルトの
  // Cookieだけを見る。片方のセッション有無がもう片方の判定に影響しない
  // ようにするのがポイント。
  const supabase = makeClient(isStoreScope ? STORE_AUTH_COOKIE_NAME : undefined);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user &&
    (pathname.startsWith("/admin") ||
      isStorePath ||
      pathname.startsWith("/mypage") ||
      pathname.startsWith("/account"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = isStorePath ? "/store/login" : "/login";
    url.searchParams.set("next", pathname);
    const response = NextResponse.redirect(url);
    pendingCookies.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options)
    );
    return response;
  }

  const maintenanceExempt =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/store/") ||
    pathname === "/login" ||
    pathname === "/maintenance" ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/go/");

  let response = NextResponse.next({ request });

  if (!maintenanceExempt) {
    // メンテナンスモードの判定は会員向けの通常ページだけなので、店舗用
    // Cookieのセッション状態に関わらずデフォルトのクライアントで見てよい
    // (isStoreScopeがfalseの経路にしか来ないため、supabaseは既にデフォルト
    // Cookie側になっている)。
    const { data: settings } = await supabase
      .from("site_settings")
      .select("maintenance_mode")
      .eq("id", true)
      .maybeSingle();

    if (settings?.maintenance_mode) {
      const url = request.nextUrl.clone();
      url.pathname = "/maintenance";
      response = NextResponse.rewrite(url);
    }
  }

  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );

  return response;
}
