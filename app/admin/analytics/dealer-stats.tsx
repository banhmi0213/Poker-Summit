import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function DealerStats() {
  // Layout rendering is not an authorization boundary for child data fetches.
  // Verify the current user here before using privileged aggregate queries.
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return null;
  const { data: admin, error: adminError } = await session
    .from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (adminError || !admin) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return <p role="alert">ディーラー登録数を取得できませんでした。</p>;

  // Only counts leave this server component; private profiles are never loaded.
  const db = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const results = await Promise.all([
    db.from("dealer_profiles").select("user_id", { count: "exact", head: true }),
    db.from("dealer_profiles").select("user_id", { count: "exact", head: true }).eq("dealer_type", "ディーラー"),
    db.from("dealer_profiles").select("user_id", { count: "exact", head: true }).eq("dealer_type", "フリーディーラー"),
  ]);
  if (results.some((result) => result.error || result.count === null)) {
    return <p role="alert">ディーラー登録数を取得できませんでした。再読み込みしてください。</p>;
  }
  const labels = ["ディーラー登録総数", "内訳：ディーラー", "内訳：フリーディーラー"];
  return (
    <section aria-label="ディーラー登録状況" style={{ marginBottom: 18 }}>
      <h2 style={{ fontSize: 16, marginBottom: 8 }}>ディーラー登録状況</h2>
      <p className="muted small">現在の登録人数（公開・非公開を含む）。店舗・期間の絞り込みには連動しません。</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {results.map((result, index) => (
          <div className="card" key={labels[index]}>
            <div className="muted" style={{ fontSize: 12.5 }}>{labels[index]}</div>
            <div className="tabular" style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{result.count!.toLocaleString("ja-JP")}<span style={{ fontSize: 14 }}> 人</span></div>
          </div>
        ))}
      </div>
    </section>
  );
}
