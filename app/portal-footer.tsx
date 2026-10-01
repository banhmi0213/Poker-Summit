import { createClient } from "@/lib/supabase/server";

export async function PortalFooter() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("site_settings")
    .select("contact_email")
    .eq("id", true)
    .maybeSingle();

  return (
    <div className="portal-footer">
      Poker Summit — 全国のポーカースポット・求人・交流をつなぐポータル
      <br />
      <a href="/contact" className="btn" style={{ fontSize: 12.5, padding: "4px 8px", marginTop: 6, display: "inline-flex" }}>
        ✉️ お問い合わせ
      </a>
      <br />
      {settings?.contact_email && (
        <>
          <span className="muted">
            サポート窓口: <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>
          </span>
          <br />
        </>
      )}
      {/* サイト最下部の規約・会社情報リンク行(2026/10/01、「サイト1番下に
          利用規約｜プライバシーポリシー｜免責事項｜特商法｜運営会社概要｜
          お問い合わせ｜掲載希望の店舗様へ」との指示により追加)。中身のページは
          仮の準備中表示で、内容は別途差し替え予定。 */}
      <div className="footer-links">
        <a href="/terms">利用規約</a>
        {" ｜ "}
        <a href="/privacy">プライバシーポリシー</a>
        {" ｜ "}
        <a href="/disclaimer">免責事項</a>
        {" ｜ "}
        <a href="/tokushoho">特定商取引法に基づく表記</a>
        {" ｜ "}
        <a href="/company">運営会社概要</a>
        {" ｜ "}
        <a href="/contact">お問い合わせ</a>
        {" ｜ "}
        <a href="/apply">掲載希望の店舗様へ</a>
      </div>
      © 2026 Poker Summit All Rights Reserved.
    </div>
  );
}
