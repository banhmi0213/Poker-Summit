import { TurnstileWidget } from "@/app/turnstile-widget";
import Link from "next/link";
import { submitInquiry } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { INQUIRY_CATEGORIES } from "@/lib/constants";
import { staticPageMetadata } from "@/lib/seo";

export const metadata = staticPageMetadata({ title: "お問い合わせ", description: "Poker Summitへのお問い合わせ窓口。店舗掲載・不具合・ご意見などはこちらから。", path: "/contact" });

export default async function ContactPage({
  searchParams,
}: {
  searchParams: { error?: string; done?: string; category?: string };
}) {
  const params = searchParams;
  const advertising = params.category === "advertising";
  const categories = advertising
    ? INQUIRY_CATEGORIES.filter(c => c !== "不具合報告").map(c => c === "掲載について" ? "店舗掲載について" : c)
    : INQUIRY_CATEGORIES;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div>
      <PortalHeader userEmail={user?.email} />
      <div className="container public-contact" style={{ maxWidth: 480 }}>
        <h1 style={{ fontSize: 20, marginBottom: 6 }}>{advertising ? "広告掲載のお問い合わせ" : "お問い合わせ"}</h1>
        <p className="muted" style={{ marginBottom: 20 }}>
          {advertising ? "掲載したい内容やご希望の期間をお知らせください" : "掲載や広告、不具合報告などお気軽にご連絡ください。"}
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
              {advertising && <>
                <input type="hidden" name="inquiry_type" value="advertising" />
                <div className="field">
                  <label htmlFor="ad-company">会社名・店舗名 *</label>
                  <input id="ad-company" name="company" type="text" required maxLength={200} autoComplete="organization" />
                </div>
              </>}
              <div className="field">
                <span className="muted">{advertising ? "担当者名 *" : "お名前 *"}</span>
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
                <select name="category" defaultValue={advertising ? "広告掲載について" : ""}>
                  <option value="">選択してください</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <span className="muted">件名 *</span>
                <input type="text" name="subject" required defaultValue={advertising ? "広告掲載のご相談" : ""} />
              </div>
              <div className="field">
                <span className="muted">お問い合わせ内容 *</span>
                <textarea name="message" rows={5} required placeholder={advertising ? "掲載したい内容・リンク先・ご希望の掲載期間などをご記入ください" : undefined} />
              </div>
              <TurnstileWidget note="送信できない場合は info@pokersummit.jp までメールでご連絡ください。" />
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
