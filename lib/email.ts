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
  attachments?: Array<{ filename: string; content: Uint8Array }>;
  bcc?: string | null;
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
    ...(params.bcc ? { bcc: [params.bcc] } : {}),
    ...(params.attachments?.length
      ? {
          attachments: params.attachments.map((a) => ({
            filename: a.filename,
            content: Buffer.from(a.content).toString("base64"),
          })),
        }
      : {}),
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

// ---------------------------------------------------------------------------
// 銀行振込の請求書メール(2026/10追加)。lib/bank-transfer.ts の sendInvoice() から。
// 請求書PDFを添付し、運営(info@)にもBCCで控えを送る。
// ---------------------------------------------------------------------------
export async function sendInvoiceEmail(params: {
  invoice: import("@/lib/bank-transfer").InvoiceRow;
  settings: import("@/lib/bank-transfer").BillingSettings;
  pdf: Uint8Array;
  kind: "new" | "renewal" | "reminder";
}): Promise<void> {
  const { invoice, settings, pdf, kind } = params;
  const { formatJpDate, cycleLabel } = await import("@/lib/bank-transfer");
  const siteUrl = getSiteUrl();
  const amount = `${invoice.total_amount.toLocaleString("ja-JP")}円（税込）`;
  const due = formatJpDate(invoice.due_date);
  const bank = settings.bank;
  const bankText = bank
    ? `${bank.bank} ${bank.branch}
${bank.type} ${bank.number}
口座名義: ${bank.holder}`
    : "別途ご案内いたします。";

  const lead =
    kind === "new"
      ? `このたびはPoker Summitへの掲載をお申し込みいただき、誠にありがとうございます。
お申し込みいただいたプランの請求書をお送りいたします。
ご入金を確認でき次第、店舗管理アカウントを発行し、ログイン情報をメールでお送りいたします。`
      : kind === "renewal"
        ? `いつもPoker Summitをご利用いただき、誠にありがとうございます。
次回の契約期間分の請求書をお送りいたします。`
        : `いつもPoker Summitをご利用いただき、誠にありがとうございます。
お支払期限が明日（${due}）となっております請求書について、ご入金をまだ確認できておりません。
お手数ですが、期限までにお振り込みをお願いいたします。
（行き違いでお振り込み済みの場合はご容赦ください。）`;

  const isNewApplication = !invoice.store_contract_id && !!invoice.listing_application_id;
  const warning =
    isNewApplication
      ? "※お支払期限を過ぎてもご入金が確認できない場合、お申し込みを取り消させていただくことがあります。"
      : "※お支払期限までにご入金が確認できない場合、期限の翌日に店舗ページの公開を停止いたします。ご入金の確認後、公開を再開いたします。";

  const text = `${invoice.bill_to_name} 様

${lead}

■ ご請求内容
請求書番号: ${invoice.invoice_number}
プラン: ${invoice.plan_name}（${cycleLabel(invoice.months, invoice.discount_label)}）
ご請求金額: ${amount}
お支払期限: ${due}

■ お振込先
${bankText}

※振込手数料はお客様のご負担にてお願いいたします。
※ご依頼人名はお申し込み時の店舗名・会社名でお願いいたします。名義が異なる場合はご連絡ください。
${warning}

請求書（PDF）を添付しております。${isNewApplication ? "" : `店舗管理画面の「プラン・お支払い」からもダウンロードできます。
${siteUrl}/store/profile/plan`}

ご不明な点は ${FROM_ADDRESS.replace(/^.*<|>$/g, "")} までお問い合わせください。

Poker Summit運営事務局`;

  const subject =
    kind === "reminder"
      ? `【Poker Summit】お支払期限のお知らせ（請求書 ${invoice.invoice_number}）`
      : `【Poker Summit】請求書のお送り（${invoice.invoice_number}）`;

  await sendEmail({
    to: invoice.bill_to_email,
    subject,
    text,
    bcc: kind === "reminder" ? null : "info@pokersummit.jp",
    attachments: [{ filename: `請求書_${invoice.invoice_number}.pdf`, content: pdf }],
  });
}

// 未入金で店舗ページを非公開にしたときの通知(店舗宛て)。
export async function sendSuspensionNoticeEmail(params: {
  to: string;
  name: string;
  invoiceNumber: string;
  amount: number;
}): Promise<void> {
  const siteUrl = getSiteUrl();
  const text = `${params.name} 様

いつもPoker Summitをご利用いただき、誠にありがとうございます。
請求書 ${params.invoiceNumber}（${params.amount.toLocaleString("ja-JP")}円）について、お支払期限までにご入金を確認できなかったため、店舗ページの公開を停止いたしました。

ご入金を確認でき次第、公開を再開いたします。
請求書は店舗管理画面の「プラン・お支払い」からダウンロードできます。
${siteUrl}/store/profile/plan

行き違いでお振り込み済みの場合や、ご不明な点がございましたら info@pokersummit.jp までご連絡ください。

Poker Summit運営事務局`;

  await sendEmail({
    to: params.to,
    subject: "【Poker Summit】店舗ページの公開を停止しました（未入金）",
    text,
    bcc: "info@pokersummit.jp",
  });
}
