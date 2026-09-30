// ============================================================================
// Resend(メール送信)APIラッパー(サーバー専用)
//
// 月額掲載契約(fincode初回課金)が成功した店舗に、ログインID/パスワード/
// LINE連携コードを自動メール送信するために追加(2026/09/30)。
// 送信元ドメインはpokersummit.jp(Resend側で送信ドメイン認証・DNS設定が
// 必要)。RESEND_API_KEYが未設定の環境ではメール送信をスキップし、
// 例外は投げない(=決済・店舗発行自体は絶対に止めない。詳細は
// sendStoreCredentialsEmail()のコメント参照)。
// ============================================================================

const FROM_ADDRESS = "Poker Summit <no-reply@pokersummit.jp>";

function getResendApiKey(): string | null {
  return process.env.RESEND_API_KEY || null;
}

async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY が設定されていません。Vercelの環境変数を確認してください。"
      );
  }

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: FROM_ADDRESS,
    to: [params.to],
    subject: params.subject,
    text: params.text,
  }),
});

if (!res.ok) {
  const body = await res.json().catch(() => null);
  throw new Error(`Resend API error (${res.status}): ${JSON.stringify(body)}`);
}
}

function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

// 決済成功直後、店舗の自動発行(lib/store-provision.ts)と同じタイミングで
// 呼ばれる想定。/apply/complete での「一度だけ画面表示」は従来通り残した
// うえで、そのバックアップ/正式な受け取り手段としてメールでも送る
// (画面を閉じてしまった、リダイレクトに失敗した等の事故対策)。
//
// ベストエフォート:呼び出し側でtry/catchし、失敗しても店舗発行・決済結果
// 自体には影響させないこと(pushLineMessage()と同じ方針。lib/line.ts参照)。
export async function sendStoreCredentialsEmail(params: {
  to: string;
  companyName: string;
  loginId: string;
  password: string;
  lineCode: string;
}): Promise<void> {
  const siteUrl = getSiteUrl();
  const text = `${params.companyName} 様

  このたびはPoker Summitへの掲載お申し込み・お支払い手続きをいただき、誠にありがとうございます。
  決済が完了し、店舗管理アカウントを発行いたしました。

  ■ 店舗管理画面ログイン情報
  URL: ${siteUrl}/login
  ログインID: ${params.loginId}
  パスワード: ${params.password}

  ■ LINE連携コード(24時間有効・1回限り)
  ${params.lineCode}
  LINE公式アカウントの店舗用メニューから、店舗アカウントとの初回連携を行う際にご利用ください。

  ※このメールに記載の情報は第三者に共有せず、大切に保管してください。
  ※LINE連携コードは24時間を過ぎると無効になります。有効期限が切れてしまった場合や、ログイン情報を紛失した場合は、運営までお問い合わせください。

  Poker Summit運営事務局`;

await sendEmail({
  to: params.to,
  subject: "【Poker Summit】店舗管理アカウント発行のお知らせ",
  text,
});
}
