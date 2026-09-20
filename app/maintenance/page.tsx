import { createClient } from "@/lib/supabase/server";

export default async function MaintenancePage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("site_settings")
    .select("maintenance_message, contact_email")
    .eq("id", true)
    .maybeSingle();

  const message =
    settings?.maintenance_message ||
    "ご不便をおかけし申し訳ございません。しばらく経ってから再度アクセスしてください。";

  return (
    <div
      className="container"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "80vh",
        textAlign: "center",
        padding: "40px 20px",
      }}
    >
      <div>
        <div style={{ fontSize: 44, marginBottom: 10 }}>🛠️</div>
        <h1 style={{ marginBottom: 10 }}>ただいまメンテナンス中です</h1>
        <p className="muted" style={{ whiteSpace: "pre-wrap" }}>
          {message}
        </p>
        {settings?.contact_email && (
          <p className="muted" style={{ marginTop: 14, fontSize: 12.5 }}>
            お問い合わせ:{" "}
            <a href={`mailto:${settings.contact_email}`} style={{ color: "var(--accent-text)", fontWeight: 700 }}>
              {settings.contact_email}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
