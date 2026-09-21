import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export default async function AccountSuspendedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div>
      <header className="header">
        <div className="brand wordmark">
          <img className="logo-img" src="/images/logo.png" alt="Poker Summit" style={{ height: 28 }} />
        </div>
        <form action={signOut}>
          <button type="submit" className="btn">
            ログアウト
          </button>
        </form>
      </header>
      <div className="container">
        <div className="card" style={{ maxWidth: 480, margin: "40px auto" }}>
          <h1 style={{ fontSize: 18, marginBottom: 12 }}>
            アカウントが利用停止中です
          </h1>
          <p className="muted" style={{ marginBottom: 16 }}>
            このアカウントは現在、利用停止の措置が取られているため、お気に入り・応募・イベント参加・クーポン利用などの機能をご利用いただけません。
            心当たりがない場合や解除をご希望の場合は、運営までお問い合わせください。
          </p>
          <Link href="/" className="btn">
            トップページへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
