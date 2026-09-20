import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { approveApplication, rejectApplication } from "../actions";
import { CATEGORY_LABEL } from "@/lib/constants";

const STATUS_LABEL: Record<string, string> = {
  pending: "未対応",
  unconfirmed: "確認中",
  approved: "承認済み",
  rejected: "却下",
  listed: "掲載済み",
};

export default async function AdminListingApplicationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("listing_applications")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!a) {
    notFound();
  }

  const isDone = a.status === "approved" || a.status === "rejected" || a.status === "listed";

  return (
    <div>
      <Link href="/admin/listing-applications" className="btn" style={{ marginBottom: 16, display: "inline-flex" }}>
        ← 掲載申込一覧へ戻る
      </Link>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>掲載申込 詳細</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        <span className="badge">{STATUS_LABEL[a.status] ?? a.status}</span>
      </p>

      <div className="card">
        <table>
          <tbody>
            <tr>
              <th style={{ width: 140 }}>会社名・屋号</th>
              <td>{a.company_name}</td>
            </tr>
            <tr>
              <th>ご担当者名</th>
              <td>{a.contact_name}</td>
            </tr>
            <tr>
              <th>電話番号</th>
              <td>{a.tel}</td>
            </tr>
            <tr>
              <th>メールアドレス</th>
              <td>{a.email}</td>
            </tr>
            <tr>
              <th>都道府県</th>
              <td>{a.pref}</td>
            </tr>
            <tr>
              <th>カテゴリ</th>
              <td>{CATEGORY_LABEL[a.category] ?? a.category}</td>
            </tr>
            <tr>
              <th>申請日</th>
              <td>{a.applied_at ? String(a.applied_at).slice(0, 10) : ""}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {a.message && (
        <div className="card">
          <div className="muted" style={{ marginBottom: 6 }}>お問い合わせ内容</div>
          <p style={{ whiteSpace: "pre-wrap" }}>{a.message}</p>
        </div>
      )}

      {!isDone && (
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <form
            action={async () => {
              "use server";
              await approveApplication(a.id);
            }}
          >
            <button type="submit" className="btn primary">
              承認して店舗作成
            </button>
          </form>
          <form
            action={async () => {
              "use server";
              await rejectApplication(a.id);
            }}
          >
            <button type="submit" className="btn">
              却下
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
