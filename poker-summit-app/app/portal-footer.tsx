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
      © 2026 Poker Summit運営事務局
    </div>
  );
}
