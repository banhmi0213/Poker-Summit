import Link from "next/link";
import { submitInquiry } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { INQUIRY_CATEGORIES } from "@/lib/constants";

export default async function ContactPage({
  searchParams,
}: {
  searchParams: { error?: string; done?: string };
}) {
  const params = searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div>
      <PortalHeader userEmail={user?.email} />
      <div className="container" style={{ maxWidth: 480 }}>
        <h1 style={{ fontSize: 20, marginBottom: 6 }}>お問い合わせ</h1>
        <p className="muted" style={{ marginBottom: 20 }}>
          掲載や広告、不具合報告などお気軽にご連絡ください。
        </p>

        {params.done ? (
          <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <h2 style={{ fontSize: 16, marginBottom: 10 }}>お問い合わせを受け付けました</h2>
            <p className="muted small" style={{ marginBottom: 20 }}>
              内容を確認のうえ、担当より折り返しご連絡いたします。
            </p>
            <Link href="/" className="btn primary" style={{ display: "inline-flex" }}>
              ホームに戻る
            </Link>
          </div>
        ) : (
          <div className="card">
            {params.error && <p className="err">{params.error}</p>}
            <form action={submitInquiry}>
              <div className="field">
                <span className="muted">お名前 *</span>
                <input type="text" name="name" required defaultValue={user?.user_metadata?.name ?? ""} />
              </div>
              <div className="field">
                <span className="muted">メールアドレス *</span>
                <input type="email" name="email" required defaultValue={user?.email ?? ""} />
              </div>
              <div className="field">
                <span className="muted">電話番号</span>
                <input type="tel" name="tel" />
              </div>
              <div className="field">
                <span className="muted">カテゴリ</span>
                <select name="category" defaultValue="">
                  <option value="">選択してください</option>
                  {INQUIRY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <span className="muted">件名 *</span>
                <input type="text" name="subject" required />
              </div>
              <div className="field">
                <span className="muted">お問い合わせ内容 *</span>
                <textarea name="message" rows={5} required />
              </div>
              <button type="submit" className="btn primary" style={{ width: "100%" }}>
                送信する
              </button>
            </form>
          </div>
        )}
      </div>
      <PortalFooter />
      <BottomTabs />
    </div>
  );
}
