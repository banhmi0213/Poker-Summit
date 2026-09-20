import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";

export default async function CouponsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: coupons } = await supabase
    .from("coupons")
    .select("id, title, discount, description, code, valid_until, store_id, stores(name)")
    .eq("active", true)
    .order("created_at", { ascending: false });

  return (
    <div>
      <PortalHeader userEmail={user?.email} />
      <div className="container">
        <h1 style={{ fontSize: 24, marginBottom: 20 }}>人気のクーポン</h1>

        {(!coupons || coupons.length === 0) && (
          <p className="muted">現在利用可能なクーポンはありません。</p>
        )}

        {coupons?.map((c: any) => (
          <Link href={`/stores/${c.store_id}`} key={c.id} style={{ display: "block" }}>
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <h3>{c.title}</h3>
                {c.discount && <span className="badge">{c.discount}</span>}
              </div>
              <div className="muted">{c.stores?.name}</div>
              {c.description && (
                <p style={{ marginTop: 6, fontSize: 13.5 }}>{c.description}</p>
              )}
              <div className="muted" style={{ marginTop: 6 }}>
                {c.code && <>クーポンコード: {c.code} </>}
                {c.valid_until && <>(有効期限: {c.valid_until})</>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
