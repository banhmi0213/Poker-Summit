import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { NOINDEX } from "@/lib/seo";
export const metadata = NOINDEX;

// カード登録〜初回課金〜自動発行まで完了したあとの表示ページ。
// app/apply/complete/callback/route.ts(fincodeのreturn_url)から303で
// 飛んでくる。ログインID/パスワード/LINE連携コードは「一度だけ」表示し、
// このページの描画時にDBから消す(以後の再読み込みでは出てこない)。
export default async function ApplyCompletePage({
  searchParams,
}: {
  searchParams: { application?: string };
}) {
  const applicationId = searchParams.application;

  if (!applicationId) {
    return <ErrorCard message="申込みIDが見つかりません。" />;
  }

  const supabase = createServiceRoleClient();
  const { data: application } = await supabase
    .from("listing_applications")
    .select(
      "id, company_name, payment_status, issued_login_id, issued_password, issued_line_code, credentials_retrieved_at"
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (!application) {
    return <ErrorCard message="申込み情報が見つかりません。" />;
  }

  if (application.payment_status === "failed") {
    return (
      <ErrorCard message="決済が完了しませんでした。お手数ですが掲載申込みページからもう一度お試しください。" />
    );
  }

  if (application.payment_status === "charged_pending_manual") {
    return (
      <Card title="お申込みありがとうございます">
        <p className="muted">
          決済は完了しました。現在、店舗情報の登録処理を確認しております。担当者より改めてログイン情報をご連絡いたしますので、今しばらくお待ちください。
        </p>
      </Card>
    );
  }

  if (application.payment_status !== "active") {
    return (
      <Card title="処理中です">
        <p className="muted">
          決済の確認処理中です。画面を閉じずにそのまま数秒お待ちいただき、再読み込みしてください。
        </p>
      </Card>
    );
  }

  const alreadyShown = Boolean(application.credentials_retrieved_at);
  const credentials =
    !alreadyShown && application.issued_login_id
      ? {
          loginId: application.issued_login_id as string,
          password: application.issued_password as string,
          lineCode: application.issued_line_code as string,
        }
      : null;

  if (credentials) {
    // 一度表示したら二度と表示しない(admin側の発行フローと同じ挙動)。
    await supabase
      .from("listing_applications")
      .update({
        issued_password: null,
        issued_line_code: null,
        credentials_retrieved_at: new Date().toISOString(),
      })
      .eq("id", applicationId);
  }

  return (
    <Card title="お申込みありがとうございます">
      <p className="muted" style={{ marginBottom: 16 }}>
        決済が完了し、{application.company_name}様の掲載アカウントを発行しました。
      </p>
      {credentials ? (
        <>
          <div
            className="card"
            style={{ background: "#fff8e1", marginBottom: 12, padding: 16 }}
          >
            <p style={{ fontWeight: 700, marginBottom: 8 }}>
              この画面を閉じると二度と表示されません。必ず控えてください。
            </p>
            <p>ログインID: {credentials.loginId}</p>
            <p>パスワード: {credentials.password}</p>
            <p>LINE連携コード: {credentials.lineCode}</p>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            ログインID・パスワードは店舗管理ログイン画面(/store/login)でご利用ください。LINE連携コードは、LINE公式アカウントの店舗用ミニアプリで店舗と紐付ける際にご利用ください(24時間有効・1回限り)。
          </p>
        </>
      ) : (
        <p className="muted">
          ログイン情報はすでに表示済みです。お控えの内容をご利用いただくか、運営までお問い合わせください。
        </p>
      )}
    </Card>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="container" style={{ maxWidth: 480, paddingTop: 40 }}>
      <div className="brand wordmark" style={{ marginBottom: 20 }}>
        <img className="logo-img" src="/images/logo.png" alt="Poker Summit" />
      </div>
      <div className="card">
        <h1 style={{ fontSize: 18, marginBottom: 8 }}>{title}</h1>
        {children}
      </div>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Card title="エラー">
      <p className="err">{message}</p>
      <a href="/apply" className="btn" style={{ marginTop: 16, display: "inline-flex" }}>
        掲載申込みページへ戻る
      </a>
    </Card>
  );
}
