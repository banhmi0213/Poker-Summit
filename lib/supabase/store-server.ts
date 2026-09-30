import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { STORE_AUTH_COOKIE_NAME } from "@/lib/constants";

// 店舗管理画面(/store/*)専用のSupabaseクライアント。lib/supabase/server.ts
// (会員・総合管理画面が使うデフォルトのCookie名)とは別のCookie名
// (STORE_AUTH_COOKIE_NAME)でセッションを保存することで、同じブラウザで
// 両方に同時ログインできるようにしている(2026/09/30)。
// 店舗側の全ページ・server actionsはこちらを使うこと(lib/supabase/server.ts
// を使うと、総合管理画面のセッションとCookieが衝突し、片方にログインした
// らもう片方がログアウトされてしまう)。
export async function createStoreClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: STORE_AUTH_COOKIE_NAME },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 呼び出し元がServer Componentの場合はここで例外になるが、
            // セッションの更新自体はmiddlewareが担うので無視してよい
            // (lib/supabase/server.ts と同じパターン)。
          }
        },
      },
    }
  );
}
