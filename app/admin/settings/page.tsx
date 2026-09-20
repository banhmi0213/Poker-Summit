import { createClient } from "@/lib/supabase/server";
import { updateSiteSettings } from "./actions";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>サイト設定</h1>

      <div className="card" style={{ maxWidth: 480 }}>
        <form action={updateSiteSettings}>
          <div className="field">
            <span className="muted">サイト名 *</span>
            <input
              type="text"
              name="siteName"
              required
              defaultValue={settings?.site_name ?? "Poker Summit"}
            />
          </div>
          <div className="field">
            <span className="muted">運営連絡先メールアドレス</span>
            <input
              type="email"
              name="contactEmail"
              defaultValue={settings?.contact_email ?? ""}
            />
          </div>
          <div
            className="field"
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <input
              type="checkbox"
              name="maintenanceMode"
              id="maintenanceMode"
              defaultChecked={settings?.maintenance_mode ?? false}
              style={{ width: "auto" }}
            />
            <label htmlFor="maintenanceMode" className="muted">
              メンテナンスモードを有効にする
            </label>
          </div>
          <button type="submit" className="btn primary">
            保存する
          </button>
        </form>
      </div>
    </div>
  );
}
