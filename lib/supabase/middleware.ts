import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { STORE_AUTH_COOKIE_NAME } from "@/lib/constants";
import { PREVIEW_COOKIE, hasPreviewAccess } from "@/lib/preview-access";
import { isPrelaunchActive } from "@/lib/prelaunch";

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

  // UU(何人が見たか)を数えるための閲覧者番号。なければ作って、このリクエストのページからも読めるようにする(2026/10/21)
  if (!request.cookies.get("ps_vid")) {
    const vid = crypto.randomUUID();
    request.cookies.set("ps_vid", vid);
    pendingCookies.push({ name: "ps_vid", value: vid, options: { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: true, httpOnly: true } });
  }

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

  // ディーラー登録広告の受け口(/account/dealer)だけは、未ログインでもページ側で受ける
  // (閲覧を数えてから会員登録へ案内し、登録後にディーラー登録へ戻すため。2026/10/21、app/account/dealer/page.tsx)
  if (!user && isProtectedPath && pathname !== "/account/dealer") {
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
  } else if (flags.prelaunch && (!isPrelaunchExempt(pathname) || isDealerPath(pathname)) && (await prelaunchAccess(request, supabase, flags.memberPreview)) !== "full") {
    // 先行登録モード中の見え方(2026/10/20):
    //  - 運営・審査用アカウント・プレビューの端末 … サイト全体(full)
    //  - 先行会員(サイト設定で「先行会員にサイトを公開」がON) … ディーラーマッチング以外(member)
    //  - それ以外 … 先行会員登録の案内ページ(none)
    const access = await prelaunchAccess(request, supabase, flags.memberPreview);
    if (isDealerPath(pathname) && (access === "member" || isPrelaunchExempt(pathname))) {
      // ディーラーマッチングは正式オープンまで閉じておく(「10/25から使えます」の案内)
      const url = request.nextUrl.clone();
      url.pathname = "/coming-soon";
      url.search = "";
      response = NextResponse.rewrite(url, { request });
    } else if (access === "none" && !isPrelaunchExempt(pathname)) {
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
  }

  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );

  return response;
}

// メンテナンスモード・先行登録モードのON/OFFは、同じサーバーの中で30秒だけ覚えておく
// (全ページの表示のたびにデータベースへ問い合わせないため。切り替えの反映は最大30秒遅れる)
let flagsCache: { value: { maintenance: boolean; prelaunch: boolean; memberPreview: boolean }; at: number } | null = null;
async function getSiteFlags(): Promise<{ maintenance: boolean; prelaunch: boolean; memberPreview: boolean }> {
  if (flagsCache && Date.now() - flagsCache.at < 30_000) return flagsCache.value;
  // ログイン状態に関係ない設定なので、Cookieなしのクライアントで読む
  // (期限切れのログイン情報で問い合わせて失敗するのを避ける)
  const anon = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
  const { data: settings, error } = await anon
    .from("site_settings")
    .select("maintenance_mode, prelaunch_mode, prelaunch_ends_at, member_preview")
    .eq("id", true)
    .maybeSingle();
  if (error) return flagsCache?.value ?? { maintenance: false, prelaunch: false, memberPreview: false };
  const value = { maintenance: !!settings?.maintenance_mode, prelaunch: isPrelaunchActive(settings), memberPreview: !!settings?.member_preview };
  flagsCache = { value, at: Date.now() };
  return value;
}

/** 先行登録モード中も開けるページ(運営・店舗管理・会員登録/ログイン・規約類・API等) */
function isPrelaunchExempt(pathname: string) {
  const exact = ["/tournaments/first-freeroll", "/prelaunch", "/preview", "/withdrawn", "/maintenance", "/login", "/login/forgot", "/admin-login", "/terms", "/privacy", "/tokushoho", "/disclaimer", "/company", "/robots.txt", "/sitemap.xml"];
  if (exact.includes(pathname)) return true;
  const prefixes = ["/admin/", "/store/", "/signup", "/auth/", "/api/", "/apply", "/contact", "/liff", "/go/", "/account/password", "/account/dealer", "/account/delete", "/_next/"];
  return pathname === "/admin" || prefixes.some((p) => pathname.startsWith(p));
}

/** 会員(運営含む)のログインCookieがあるか。無ければ運営チェックの問い合わせを省く */
function hasMemberSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token") && !c.name.startsWith(STORE_AUTH_COOKIE_NAME));
}

/**
 * 先行登録モード中もサイト全体を見られるアカウントの追加分(運営以外)。
 * 決済代行(KOMOJU)・カード会社の審査担当が、サイトの中身を確認できるようにするため(2026/10)。
 * 審査が終わってアカウントを削除すれば、ここに残っていても何も起きない。
 */
const PRELAUNCH_PREVIEW_EMAILS = ["support-jp@komoju.com"];

/**
 * ディーラーマッチング(正式オープンまで先行会員にも閉じておく、2026/10/20)。
 * ディーラー登録(/account/dealer)は先行登録ページで「オープン前から登録できます」と案内しているので開けたまま。
 * ただしその中のマッチングのチャット・勤務管理は閉じる。
 */
function isDealerPath(pathname: string) {
  return ["/spot-jobs", "/matching", "/matching-guide", "/account/dealer/chat", "/account/dealer/work"].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * 先行登録モード中にどこまで見せるか。同じリクエストの中では1回だけ調べる。
 *  full   … 運営としてログイン中・審査用アカウント・プレビューの端末(サイト全体)
 *  member … 先行会員(メール確認済みの会員。サイト設定で「先行会員にサイトを公開」がONのときだけ)
 *  none   … それ以外
 */
const accessCache = new WeakMap<NextRequest, Promise<"full" | "member" | "none">>();
function prelaunchAccess(request: NextRequest, supabase: ReturnType<typeof createServerClient>, memberPreview: boolean) {
  let p = accessCache.get(request);
  if (!p) {
    p = (async () => {
      if (await hasPreviewAccess(request.cookies.get(PREVIEW_COOKIE)?.value)) return "full" as const;
      if (!hasMemberSessionCookie(request)) return "none" as const;
      try {
        const { data: admin } = await supabase.rpc("is_admin");
        if (admin === true) return "full" as const;
        const { data: u } = await supabase.auth.getUser();
        const user = u.user;
        if (!user) return "none" as const;
        if (user.email && PRELAUNCH_PREVIEW_EMAILS.includes(user.email.toLowerCase())) return "full" as const;
        if (memberPreview && user.email_confirmed_at && !user.is_anonymous) return "member" as const;
        return "none" as const;
      } catch {
        return "none" as const;
      }
    })();
    accessCache.set(request, p);
  }
  return p;
}
