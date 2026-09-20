import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function CouponsPage() {
  const supabase = await createClient();

  const { data: coupons } = await supabase
    .from("coupons")
    .select("id, title, discount, description, code, valid_until, store_id, stores(name)")
    .eq("active", true)
    .order("created_at", { ascending: false });

  return (
    <div>
      <header className="header">
        <div className="brand">Poker Summit</div>
        <Link href="/" className="btn">
          店舗一覧へ戻る
        </Link>
      </header>
      <div className="container">
        <h1 style={{ fontSize: 24, marginBottom: 20 }}>クーポン一覧</h1>

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
