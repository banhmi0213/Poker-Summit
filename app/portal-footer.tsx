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
      <div style={{ maxWidth: 1140, margin: "16px auto", padding: "12px 16px", borderTop: "1px solid #ded5c5", borderBottom: "1px solid #ded5c5", textAlign: "left", fontSize: 13, lineHeight: 1.7 }}>
        <p style={{ margin: "0 0 3px" }}>
          本サービスはアミューズメントポーカーの情報ポータルです。金銭・物品を賭ける行為や換金サービスを提供しません。
        </p>
        <p style={{ margin: "0 0 3px" }}>
          国内アミューズメント店舗の掲載条件として、リアルマネーの賭けおよびチップ・ポイント等の換金を禁止しています。
        </p>
        <p style={{ margin: 0 }}>
          決済対象は店舗掲載プラン・広告・アドオン等のサービス利用料金です。
        </p>
        <div style={{ marginTop: 5, textAlign: "left" }}>
          <a href="/terms#amusement-policy" style={{ display: "inline-block", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}>詳しくは利用規約へ</a>
        </div>
      </div>
      <nav className="footer-links" aria-label="フッターリンク">
        <a href="/terms">利用規約</a>
        <span className="footer-links__separator" aria-hidden="true"> ｜ </span>
        <a href="/privacy">プライバシーポリシー</a>
        <span className="footer-links__separator" aria-hidden="true"> ｜ </span>
        <a href="/disclaimer">免責事項</a>
        <span className="footer-links__separator" aria-hidden="true"> ｜ </span>
        <a href="/tokushoho">特定商取引法に基づく表記</a>
        <span className="footer-links__separator" aria-hidden="true"> ｜ </span>
        <a href="/company">運営会社概要</a>
        <span className="footer-links__separator" aria-hidden="true"> ｜ </span>
        <a href="/contact">お問い合わせ</a>
        <span className="footer-links__separator footer-links__apply-separator" aria-hidden="true"> ｜ </span>
        <a className="footer-links__apply" href="/apply">掲載希望の店舗様へ</a>
      </nav>
      <div className="footer-copyright">© 2026 Poker Summit All Rights Reserved.</div>
      <a className="footer-apply-mobile" href="/apply">掲載希望の店舗様へ</a>
    </div>
  );
}
