import Link from "next/link";
import { redirect } from "next/navigation";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { SITE_URL } from "@/lib/seo";
import { CopyBox } from "./copy-box";

// 掲載バナー・リンク(2026/10/23)。お店のホームページやSNSのプロフィールから
// Poker Summitの店舗ページへリンクしてもらうための、URL・バナー画像・HTMLをまとめたページ。
const BADGE_PATH = "/badge/poker-summit-listed.png";
const PUBLIC_STATUSES = ["approved", "listed"];

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default async function StoreLinkBannerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/store/login?next=/store/profile/link-banner");

  const { data: store } = await supabase.from("stores").select("id, name, status").eq("owner_user_id", user.id).maybeSingle();
  if (!store) {
    return (
      <div className="container">
        <p className="err">このアカウントに紐づく店舗が見つかりません。</p>
      </div>
    );
  }

  const pageUrl = `${SITE_URL}/stores/${store.id}`;
  const name = escapeHtml(store.name ?? "");
  const bannerHtml = `<a href="${pageUrl}" target="_blank" rel="noopener"><img src="${SITE_URL}${BADGE_PATH}" alt="Poker Summit 掲載店舗 ${name}" width="240" height="100" loading="lazy"></a>`;
  const textHtml = `<a href="${pageUrl}" target="_blank" rel="noopener">${name}の店舗情報（Poker Summit）</a>`;
  const isPublic = PUBLIC_STATUSES.includes(store.status ?? "");

  return (
    <div>
      <Link href="/store/profile" className="btn" style={{ marginBottom: 16, display: "inline-flex" }}>
        店舗情報編集へ戻る
      </Link>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>掲載バナー・リンク</h1>
      <p className="muted" style={{ marginBottom: 20, lineHeight: 1.8 }}>
        お店のホームページ・ブログ・XやInstagramのプロフィールに、Poker Summitの店舗ページへのリンクを貼ってください。
        お客さまが営業時間・トーナメント・クーポンなどの最新情報をすぐ確認できるようになります。
      </p>

      {!isPublic && (
        <p className="err" style={{ marginBottom: 16 }}>
          現在、店舗ページは公開されていません。公開されてからリンクを貼ってください。
        </p>
      )}

      <section className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, marginBottom: 6 }}>店舗ページのURL</h2>
        <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
          XやInstagramのプロフィールのリンク欄、投稿、LINE公式アカウントなどに貼れます。
        </p>
        <CopyBox label="店舗ページのURL" value={pageUrl} />
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, marginBottom: 6 }}>ホームページ用バナー</h2>
        <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
          下のHTMLをお店のホームページに貼ると、このバナーが表示され、押すと店舗ページが開きます。
        </p>
        <div style={{ marginBottom: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BADGE_PATH} alt="Poker Summit 掲載店舗" width={240} height={100} style={{ maxWidth: "100%", height: "auto" }} />
        </div>
        <CopyBox label="バナーのHTML" value={bannerHtml} multiline />
      </section>

      <section className="card">
        <h2 style={{ fontSize: 16, marginBottom: 6 }}>文字のリンク</h2>
        <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
          バナーが入れにくい場所（店舗情報の欄・フッターなど）には、文字のリンクをお使いください。
        </p>
        <CopyBox label="文字リンクのHTML" value={textHtml} multiline />
      </section>
    </div>
  );
}
