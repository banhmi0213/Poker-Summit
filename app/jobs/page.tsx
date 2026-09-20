import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function JobsPage() {
  const supabase = await createClient();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, job_type, salary, description, posted_at, store_id, stores(name)")
    .eq("status", "open")
    .order("posted_at", { ascending: false });

  return (
    <div>
      <header className="header">
        <div className="brand">Poker Summit</div>
        <Link href="/" className="btn">
          店舗一覧へ戻る
        </Link>
      </header>
      <div className="container">
        <h1 style={{ fontSize: 24, marginBottom: 20 }}>求人一覧</h1>

        {(!jobs || jobs.length === 0) && (
          <p className="muted">現在募集中の求人はありません。</p>
        )}

        {jobs?.map((j: any) => (
          <Link href={`/stores/${j.store_id}`} key={j.id} style={{ display: "block" }}>
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <h3>{j.title}</h3>
                {j.job_type && <span className="badge">{j.job_type}</span>}
              </div>
              <div className="muted">{j.stores?.name}</div>
              {j.salary && <p className="muted">{j.salary}</p>}
              {j.description && (
                <p style={{ marginTop: 6, fontSize: 13.5 }}>{j.description}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
