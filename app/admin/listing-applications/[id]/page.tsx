import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { approveApplication, rejectApplication, reviewApplicationKyc } from "../actions";
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
  searchParams,
}: {
  params: { id: string };
  searchParams?: { kyc?: string };
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
        掲載申込一覧へ戻る
      </Link>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>掲載申込 詳細</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        <span className="badge">{STATUS_LABEL[a.status] ?? a.status}</span>
      </p>

      <div className="card">
        <table>
          <tbody>
            <tr>
              <th style={{ width: 140 }}>申込み名義</th>
              <td>{a.company_name}（{a.applicant_type === "company" ? "会社名" : "店舗名"}）</td>
            </tr>
            <tr>
              <th>店舗名</th>
              <td>{a.store_name || a.company_name}</td>
            </tr>
            <tr>
              <th>店舗の住所</th>
              <td>{a.address || "（未入力）"}</td>
            </tr>
            <tr>
              <th>掲載中の店舗</th>
              <td>{a.matched_store_id ? <a href={`/stores/${a.matched_store_id}`} target="_blank" rel="noopener noreferrer">結び付けあり（店舗ページを開く）</a> : "なし（新しい店舗として掲載）"}</td>
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

      {a.plan_id && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>事業者の確認（本人確認・反社会的勢力のチェック）</h2>
          {searchParams?.kyc && <p className="muted" role="status" style={{ fontSize: 13, color: "var(--accent-strong, #8a5a00)" }}>{searchParams.kyc}</p>}
          <table>
            <tbody>
              <tr><th style={{ width: 160 }}>事業者の区分</th><td>{a.entity_type === "corporation" ? "法人" : a.entity_type === "individual" ? "個人事業主" : "（未入力・2026/10/21以前の申込み）"}</td></tr>
              <tr><th>代表者名</th><td>{a.representative_name || "（未入力）"}</td></tr>
              <tr><th>法人番号の照合</th><td>{a.entity_type === "corporation" ? <><a href="https://www.houjin-bangou.nta.go.jp/" target="_blank" rel="noopener noreferrer">国税庁の法人番号公表サイト</a>で、法人名「{a.company_name}」と所在地から探して照合する{a.corporate_number ? `（申込時の法人番号：${a.corporate_number}）` : ""}</> : "（個人事業主のため不要。代表者の本人確認書類を確認）"}</td></tr>
              <tr><th>許可番号など</th><td>{a.license_number || "（なし）"}</td></tr>
              <tr><th>反社でないことの表明・確約</th><td>{a.antisocial_pledged_at ? `あり（${String(a.antisocial_pledged_at).slice(0, 16).replace("T", " ")}）` : "なし"}</td></tr>
              <tr><th>確認の状態</th><td>{a.kyc_status === "ok" ? "確認OK" : a.kyc_status === "ng" ? "確認NG（却下）" : "確認待ち"}{a.kyc_checked_at ? `（${a.kyc_checked_email ?? ""}・${String(a.kyc_checked_at).slice(0, 16).replace("T", " ")}）` : ""}</td></tr>
              <tr><th>お支払い</th><td>{a.payment_status === "awaiting_review" ? "確認待ち（請求書・お支払いの案内はまだ送っていません）" : a.payment_status}</td></tr>
              {a.kyc_note && <tr><th>確認メモ</th><td style={{ whiteSpace: "pre-wrap" }}>{a.kyc_note}</td></tr>}
            </tbody>
          </table>
          {a.kyc_status === "pending" && (
            <form action={reviewApplicationKyc.bind(null, a.id)} style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
                確認の手順：①法人は国税庁の法人番号公表サイトで法人名・所在地から探し、法人番号・名称・所在地を照合（法人番号は確認メモに残す）／個人事業主は代表者の本人確認書類を確認　②店舗名・法人名・代表者名で検索し、反社会的勢力との関係をうかがわせる報道などがないか確認　③問題がなければ「確認OK」。確認OKにすると、請求書（振込）またはお支払いページの案内（カード）が自動で送られます。
              </p>
              <label><input type="checkbox" name="corpChecked" /> 法人番号・名称・所在地を照合した（法人の場合）</label>
              <label><input type="checkbox" name="identityChecked" /> 代表者の本人確認書類を確認した（個人事業主の場合）</label>
              <label><input type="checkbox" name="newsChecked" /> 公開情報（報道等）で反社会的勢力との関係がないことを確認した</label>
              <textarea name="note" rows={3} placeholder="確認メモ（検索した内容、確認した書類など）" />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" name="decision" value="ok" className="btn primary">確認OK（請求書・お支払いの案内を送る）</button>
                <button type="submit" name="decision" value="ng" className="btn">確認NG（お申し込みを却下）</button>
              </div>
            </form>
          )}
        </div>
      )}

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
