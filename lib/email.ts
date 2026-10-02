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

const FROM_ADDRESS = "Poker Summit <info@pokersummit.jp>";

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
  URL: ${siteUrl}/store/login
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

// ---------------------------------------------------------------------------
// 求人応募の通知メール(2026/10追加、「応募がきたら店舗オーナーにLINEと
// メールで連絡が飛ぶようにして」との指示を受けて追加)。
// app/member-actions.ts の submitJobApplication() から、新規応募(重複
// エラーではない)の直後に呼ばれる。宛先は get_job_notification_target()
// RPC(security definer。store_contracts.contact_email、ステータスactive
// の契約のみ)経由で取得したもの。
// ベストエフォート: 呼び出し側でtry/catchし、送信失敗(RESEND_API_KEY
// 未設定・宛先未設定含む)で応募受付自体は止めないこと
// (sendStoreCredentialsEmail()と同じ方針。lib/line.ts の pushLineMessage()
// も同時に呼ばれる)。
// ---------------------------------------------------------------------------
export async function sendJobApplicationNotificationEmail(params: {
  to: string;
  storeName: string;
  jobTitle: string;
  applicantName: string;
}): Promise<void> {
  const siteUrl = getSiteUrl();
  const text = `${params.storeName} 様

Poker Summitの求人「${params.jobTitle}」に新しい応募がありました。

応募者名: ${params.applicantName}

応募者の詳細(年齢・性別・ディーラー経験・連絡先等)は、店舗管理画面の
「求人管理」からご確認ください。
${siteUrl}/store/profile/jobs

Poker Summit運営事務局`;

  await sendEmail({
    to: params.to,
    subject: `【Poker Summit】求人「${params.jobTitle}」に応募がありました`,
    text,
  });
}

// ---------------------------------------------------------------------------
// お問い合わせ・掲載申込の運営宛て通知メール(2026/10追加、「問い合わせ、
// 掲載申込があったらメール届くように設定しておいて」との指示を受けて追加)。
// app/contact/actions.ts の submitInquiry()、app/apply/actions.ts の
// submitApplication()/startPaidApplication() から、新規insert成功直後に
// 呼ばれる。宛先は site_settings.notify_email(管理画面「通知設定」で設定、
// 現状 info@pokersummit.jp)。notify_inquiry/notify_new_listing がONの
// ときだけ呼び出し元で呼ばれる想定(フラグ判定は呼び出し側で行う)。
// ベストエフォート: 呼び出し側でtry/catchし、送信失敗(RESEND_API_KEY
// 未設定・notify_email未設定含む)で申込・問い合わせ受付自体は止めない
// こと(sendJobApplicationNotificationEmail()と同じ方針)。
// ---------------------------------------------------------------------------
export async function sendInquiryNotificationEmail(params: {
  to: string;
  name: string;
  email: string;
  tel?: string | null;
  subject?: string | null;
  category?: string | null;
  message: string;
}): Promise<void> {
  const siteUrl = getSiteUrl();
  const text = `Poker Summitに新しいお問い合わせがありました。

お名前: ${params.name}
メールアドレス: ${params.email}
電話番号: ${params.tel || "(未記入)"}
カテゴリ: ${params.category || "(未選択)"}
件名: ${params.subject || "(未記入)"}

本文:
${params.message}

管理画面の「お問い合わせ」からご確認ください。
${siteUrl}/admin/inquiries

Poker Summit運営事務局`;

  await sendEmail({
    to: params.to,
    subject: `【Poker Summit】新しいお問い合わせがあります(${params.name} 様)`,
    text,
  });
}

export async function sendListingApplicationNotificationEmail(params: {
  to: string;
  companyName: string;
  contactName: string;
  email: string;
  tel?: string | null;
  pref?: string | null;
  category?: string | null;
  message?: string | null;
}): Promise<void> {
  const siteUrl = getSiteUrl();
  const text = `Poker Summitに新しい掲載申込がありました。

店舗名・会社名: ${params.companyName}
ご担当者名: ${params.contactName}
メールアドレス: ${params.email}
電話番号: ${params.tel || "(未記入)"}
エリア: ${params.pref || "(未選択)"}
カテゴリ: ${params.category || "(未選択)"}

備考:
${params.message || "(なし)"}

管理画面の「掲載申込」からご確認ください。
${siteUrl}/admin/listing-applications

Poker Summit運営事務局`;

  await sendEmail({
    to: params.to,
    subject: `【Poker Summit】新しい掲載申込があります(${params.companyName} 様)`,
    text,
  });
}

// ---------------------------------------------------------------------------
// 管理画面からの店舗への一斉メール配信(2026/10/01追加)
//
// 宛先ごとにtry/catchし、一部の宛先への送信失敗が他の宛先への送信を止めない
// ようにする(1通のResend API呼び出しにつき宛先1件。失敗した宛先だけを
// 呼び出し元(admin/stores/bulk-email)に返し、画面に結果を表示する)。
// ---------------------------------------------------------------------------
export async function sendBulkEmail(params: {
  recipients: string[];
  subject: string;
  text: string;
}): Promise<{ sent: string[]; failed: { to: string; error: string }[] }> {
  const sent: string[] = [];
  const failed: { to: string; error: string }[] = [];

  for (const to of params.recipients) {
    try {
      await sendEmail({ to, subject: params.subject, text: params.text });
      sent.push(to);
    } catch (e) {
      failed.push({ to, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return { sent, failed };
}
