// ============================================================================
// Resend(メール送信)APIラッパー(サーバー専用)
//
// 月額掲載契約(カード初回課金)が成功した店舗に、ログインID/パスワード/
// LINE連携コードを自動メール送信するために追加(2026/09/30)。
// 送信元ドメインはpokersummit.jp(Resend側で送信ドメイン認証・DNS設定が
// 必要)。RESEND_API_KEYが未設定の環境ではメール送信をスキップし、
// 例外は投げない(=決済・店舗発行自体は絶対に止めない。詳細は
// sendStoreCredentialsEmail()のコメント参照)。
// ============================================================================

import { freerollSignupOpen, FREEROLL_ELIGIBILITY } from "@/lib/prelaunch";
import { logMessage } from "@/lib/message-log";

const FROM_ADDRESS = "Poker Summit <info@pokersummit.jp>";
// 送信専用(返信を受けない)アドレス(2026/10)。会員向け・本人確認やセキュリティのお知らせに使う。
// 店舗向けの請求・契約まわりは、返信で問い合わせてもらえるよう info@ のまま。
const NOREPLY_ADDRESS = "Poker Summit <noreply@pokersummit.jp>";

function getResendApiKey(): string | null {
  return process.env.RESEND_API_KEY || null;
}

async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  attachments?: Array<{ filename: string; content: Uint8Array }>;
  bcc?: string | null;
  /** true なら送信専用アドレス(noreply@)から送る */
  noreply?: boolean;
  /** true なら送信の記録(message_log)に本文を残さない(パスワード・確認コード・ログイン情報、2026/10/20) */
  sensitive?: boolean;
}): Promise<void> {
  const apiKey = getResendApiKey();
  const log = (status: "sent" | "failed" | "skipped", extra: { error?: string; providerId?: string | null } = {}) =>
    logMessage({ channel: "email", to: params.to, subject: params.subject, body: params.text, sensitive: params.sensitive, hasAttachment: !!params.attachments?.length, status, ...extra });
  if (!apiKey) {
    await log("skipped", { error: "RESEND_API_KEY 未設定" });
    throw new Error(
      "RESEND_API_KEY が設定されていません。Vercelの環境変数を確認してください。"
      );
  }

let res: Response;
try {
res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: params.noreply ? NOREPLY_ADDRESS : FROM_ADDRESS,
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
} catch (e) {
  await log("failed", { error: e instanceof Error ? e.message : String(e) });
  throw e;
}

if (!res.ok) {
  const body = await res.json().catch(() => null);
  const message = `Resend API error (${res.status}): ${JSON.stringify(body)}`;
  await log("failed", { error: message });
  throw new Error(message);
}
const okBody = (await res.json().catch(() => null)) as { id?: string } | null;
await log("sent", { providerId: okBody?.id ?? null });
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
お支払いを確認し、店舗管理アカウントを発行いたしました。

■ 店舗管理画面ログイン情報
URL: ${siteUrl}/store/login
ログインID: ${params.loginId}
パスワード: ${params.password}

■ LINE連携コード(24時間有効・1回限り)
${params.lineCode}
LINE公式アカウントの店舗用メニューから、店舗アカウントとの初回連携を行う際にご利用ください。
※24時間を過ぎた場合も、店舗管理画面のトップにある「LINE連携コードを発行する」から、いつでも新しいコードを発行できます。

※このメールに記載の情報は第三者に共有せず、大切に保管してください。
※ログイン情報を紛失した場合は、お問い合わせフォームよりご連絡ください。
${siteUrl}/contact

Poker Summit運営事務局`;

await sendEmail({
  to: params.to,
  subject: "【Poker Summit】店舗管理アカウント発行のお知らせ",
  text,
  sensitive: true, // ログイン情報を含むので、送信の記録に本文を残さない
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
  storeName?: string | null;
  matchedStoreId?: string | null;
  contactName: string;
  email: string;
  tel?: string | null;
  pref?: string | null;
  category?: string | null;
  message?: string | null;
}): Promise<void> {
  const siteUrl = getSiteUrl();
  const text = `Poker Summitに新しい掲載申込がありました。

申込み名義: ${params.companyName}
店舗名: ${params.storeName || params.companyName}
掲載中の店舗との結び付け: ${params.matchedStoreId ? `あり（${siteUrl}/stores/${params.matchedStoreId}）` : "なし（新しい店舗として掲載）"}
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
  const isAddon = invoice.kind === "addon";
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

  const lead = isAddon && kind !== "reminder"
    ? `いつもPoker Summitをご利用いただき、誠にありがとうございます。
アドオン「${invoice.plan_name}」の請求書をお送りいたします。ご入金を確認でき次第、ご利用いただけるようになります。`
    : kind === "new"
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
  const warning = isAddon
    ? "※お支払期限から7日を過ぎてもご入金が確認できない場合、お申し込み・アドオンのご利用を停止いたします。"
    : isNewApplication
      ? "※お支払期限を過ぎてもご入金が確認できない場合、お申し込みを取り消させていただくことがあります。"
      : "※お支払期限から7日を過ぎてもご入金が確認できない場合、店舗ページの公開を停止いたします。ご入金の確認後、公開を再開いたします。";

  const text = `${invoice.bill_to_name} 様

${lead}

■ ご請求内容
請求書番号: ${invoice.invoice_number}
${isAddon ? `内容: アドオン「${invoice.plan_name}」` : `プラン: ${invoice.plan_name}（${cycleLabel(invoice.months, invoice.discount_label)}）`}
ご請求金額: ${amount}
${isAddon ? "" : `ご利用期間: ${invoice.period_start && invoice.period_end ? `${formatJpDate(invoice.period_start)}〜${formatJpDate(invoice.period_end)}` : `ご入金確認日から${invoice.months}か月`}
`}お支払期限: ${due}

■ お振込先
${bankText}

※振込手数料はお客様のご負担にてお願いいたします。
※ご依頼人名はお申し込み時の店舗名・会社名でお願いいたします。名義が異なる場合はご連絡ください。
${warning}

請求書（PDF）を添付しております。${isNewApplication ? "" : `店舗管理画面の「プラン・お支払い」からもダウンロードできます。
${siteUrl}/store/profile/plan`}

ご不明な点は、このメールへのご返信またはお問い合わせフォームからご連絡ください。
${siteUrl}/contact

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
請求書 ${params.invoiceNumber}（${params.amount.toLocaleString("ja-JP")}円）について、お支払期限から7日を過ぎてもご入金を確認できなかったため、店舗ページの公開を停止いたしました。

ご入金を確認でき次第、公開を再開いたします。
請求書は店舗管理画面の「プラン・お支払い」からダウンロードできます。
${siteUrl}/store/profile/plan

行き違いでお振り込み済みの場合や、ご不明な点がございましたら、このメールへのご返信またはお問い合わせフォームからご連絡ください。
${getSiteUrl()}/contact

Poker Summit運営事務局`;

  await sendEmail({
    to: params.to,
    subject: "【Poker Summit】店舗ページの公開を停止しました（未入金）",
    text,
    bcc: "info@pokersummit.jp",
  });
}

// ---------------------------------------------------------------------------
// 店舗のプラン変更の確認メール(2026/10追加)。店舗管理画面の「プラン・お支払い」で
// 変更したとき、契約の連絡先メールへ送り、運営(info@)にもBCCで控えを送る。
// kind: changed=即時変更(決済済み) / scheduled=契約期間の終了時に変更予約 / failed=決済失敗
// ---------------------------------------------------------------------------
export async function sendPlanChangeEmail(params: {
  to: string;
  storeName: string;
  kind: "changed" | "scheduled" | "failed";
  fromPlan: string;
  toPlan: string;
  amount?: number | null;
  effectiveDate?: string | null; // 表示用(例: 2026年11月9日)
  periodEnd?: string | null; // 表示用
  reason?: string | null;
}): Promise<void> {
  const siteUrl = getSiteUrl();
  const body =
    params.kind === "changed"
      ? `プランの変更が完了しました。

変更前: ${params.fromPlan}
変更後: ${params.toPlan}
決済金額: ${(params.amount ?? 0).toLocaleString("ja-JP")}円（税込・クレジットカード）
${params.periodEnd ? `新しい契約期間: ${params.periodEnd}まで（以降は毎月自動更新）\n` : ""}
新しいプランの機能は、すでにご利用いただけます。`
      : params.kind === "scheduled"
        ? `プランの変更を予約しました。

現在のプラン: ${params.fromPlan}
変更後のプラン: ${params.toPlan}
切り替え日: ${params.effectiveDate ?? "現在の契約期間の終了日"}

切り替え日までは現在のプランのままご利用いただけます。切り替え日に新しい料金で決済されます。
予約の取り消しは、店舗管理画面の「プラン・お支払い」から行えます。`
        : `プランの変更手続きで、決済が完了しませんでした。プランは変更されていません。

現在のプラン: ${params.fromPlan}
変更しようとしたプラン: ${params.toPlan}
${params.reason ? `理由: ${params.reason}\n` : ""}
お手数ですが、カード情報をご確認のうえ再度お試しいただくか、運営までお問い合わせください。`;

  const text = `${params.storeName} 様

いつもPoker Summitをご利用いただき、誠にありがとうございます。
${body}

店舗管理画面「プラン・お支払い」
${siteUrl}/store/profile/plan

ご不明な点は、このメールへのご返信またはお問い合わせフォームからご連絡ください。
${getSiteUrl()}/contact

Poker Summit運営事務局`;

  const subject =
    params.kind === "changed"
      ? `【Poker Summit】プラン変更完了のお知らせ（${params.toPlan}）`
      : params.kind === "scheduled"
        ? `【Poker Summit】プラン変更予約のお知らせ（${params.toPlan}）`
        : "【Poker Summit】プラン変更の決済ができませんでした";

  await sendEmail({ to: params.to, subject, text, bcc: "info@pokersummit.jp" });
}

// アドオン注文(制作・設定が必要なもの)の運営宛て通知(2026/10)。
export async function sendAddonOrderAdminEmail(params: {
  storeName: string;
  addonName: string;
  quantity: number;
  total: number;
  paymentMethod: string;
  note: string | null;
}): Promise<void> {
  const siteUrl = getSiteUrl();
  const text = `アドオンのお申し込み（お支払い済み）がありました。対応をお願いします。

店舗: ${params.storeName}
アドオン: ${params.addonName}
数量: ${params.quantity}
金額: ${params.total.toLocaleString("ja-JP")}円（${params.paymentMethod === "card" ? "カード" : "銀行振込"}）
店舗からの連絡事項: ${params.note || "（なし）"}

総合管理「アドオン注文」から状況を更新してください。
${siteUrl}/admin/addon-orders

Poker Summit`;
  await sendEmail({
    to: "info@pokersummit.jp",
    subject: `【Poker Summit】アドオン申込み: ${params.addonName}（${params.storeName}）`,
    text,
  });
}

// 会員登録の完了メール(2026/10)。メールアドレスの確認が済んだとき(app/auth/confirm)に1回だけ送る。
export async function sendWelcomeEmail(params: {
  to: string;
  name: string | null;
  /** 先行登録モード中の登録なら true(オープン前に開けるリンクだけの先行会員版を送る) */
  prelaunch?: boolean;
  /** 先行会員にサイトを公開中なら true(登録したらすぐサイトを見られる文面にする、2026/10/20) */
  memberPreview?: boolean;
  xUrl?: string | null;
}): Promise<void> {
  const siteUrl = getSiteUrl();
  if (params.prelaunch) {
    const status = params.memberPreview
      ? `先行会員の皆さまには、10/25（日）の正式オープンに先がけてサイトを公開しています。
ログインすると、全国のアミューズメントポーカー店・ポーカーバーの検索や、サミット（掲示板）などをすぐにご利用いただけます。
▼サイトを見る
${siteUrl}/
※スポット求人・ディーラーマッチングは、10/25（日）の正式オープンからご利用いただけます。

先行会員限定トーナメントの詳細は、このメールアドレスと公式Xでお知らせします。`
      : `Poker Summitは現在、オープンに向けて準備を進めています。
サイトのオープン日や、先行会員限定トーナメントの詳細は、このメールアドレスと公式Xでお知らせします。`;
    const after = params.memberPreview
      ? "10/25（日）の正式オープンからは、トーナメント・イベント情報、求人、クーポンなども順次掲載していきます。"
      : "オープン後は、全国のアミューズメントポーカー店・ポーカーバーの検索、トーナメント・イベント情報、求人、クーポンなどをご利用いただけます。";
    const closing = params.memberPreview ? "Poker Summitをどうぞお楽しみください。" : "オープンまで、今しばらくお待ちください。";
    const text = `${params.name ? `${params.name} 様` : "Poker Summit先行会員の皆さま"}

このたびはPoker Summitに先行会員としてご登録いただき、誠にありがとうございます。
先行会員登録が完了しました。

${status}
${params.xUrl ? `
▼公式X
${params.xUrl}
` : ""}
■ 先行会員限定トーナメントについて
m HOLD’EMアプリで開催する限定トーナメントにご招待します。
トーナメントの参加IDは、後ほどこのメールアドレスにお送りします。
※参加にはアプリ内アイテム（ダイヤ）が必要です。
※本大会はPoker Summit主催です（サミー株式会社・m HOLD’EMの公認・協賛大会ではありません）。

■ ポーカーディーラーの方へ
オープン前からディーラー登録ができます。
登録しておくと、オープン後すぐに店舗のスポット求人への応募や、店舗からのお仕事のオファーを受けられます。
▼ディーラー登録はこちら
${siteUrl}/account/dealer

${after}

ご不明な点がございましたら、お問い合わせフォームよりお気軽にご連絡ください。
${siteUrl}/contact

${closing}

Poker Summit運営事務局
※このメールは送信専用です。`;
    await sendEmail({ noreply: true, to: params.to, subject: "【Poker Summit】先行会員登録が完了しました", text });
    return;
  }
  const text = `${params.name ? `${params.name} 様` : "Poker Summit会員の皆さま"}

このたびはPoker Summitにご登録いただき、誠にありがとうございます。
会員登録が完了しました。

Poker Summitでは、全国のアミューズメントポーカー店・ポーカーバーの検索、トーナメント・イベント情報、求人、クーポンなどをご覧いただけます。

${freerollSignupOpen() ? `■ 会員限定フリーロール（10/25（日）21:00）
${FREEROLL_ELIGIBILITY}が参加できる、m HOLD’EMアプリの限定トーナメントです。参加方法・参加IDは、後ほどこのメールアドレスにお送りします。
▼大会の詳細
${siteUrl}/tournaments/first-freeroll
※参加にはアプリ内アイテム（ダイヤ）が必要です。
※本大会はPoker Summit主催です（サミー株式会社・m HOLD’EMの公認・協賛大会ではありません）。

` : ""}■ 会員になるとできること
・お気に入り店舗の登録
・求人への応募
・クーポンの利用
・イベントへの参加登録

■ ポーカーディーラーの方へ
ディーラー登録をすると、店舗のスポット求人への応募や、店舗からのお仕事のオファーを受けられるようになります。
（ディーラー向けの機能は、ディーラー登録をした会員の方だけに表示されます）
▼ディーラー登録はこちら
${siteUrl}/account/dealer

▼マイページ
${siteUrl}/mypage

▼店舗を探す
${siteUrl}/stores

ご不明な点がございましたら、お問い合わせフォームよりお気軽にご連絡ください。
${siteUrl}/contact

今後ともPoker Summitをよろしくお願いいたします。

Poker Summit運営事務局
※このメールは送信専用です。`;

  await sendEmail({ noreply: true,
    to: params.to,
    subject: "【Poker Summit】会員登録が完了しました",
    text,
  });
}

/** 店舗管理・運営画面へのログインがあったことの通知(不正ログインの早期発見用) */
export async function sendLoginNotificationEmail(params: {
  to: string;
  accountLabel: string; // 例: 「店舗管理(〇〇ポーカー)」
  at: Date;
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  const siteUrl = getSiteUrl();
  const when = params.at.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const text = `Poker Summit をご利用いただきありがとうございます。

${params.accountLabel}へのログインがありました。

■ 日時：${when}（日本時間）
■ IPアドレス：${params.ip ?? "不明"}
■ ブラウザ：${(params.userAgent ?? "不明").slice(0, 200)}

ご本人によるログインであれば、このメールへの対応は不要です。

心当たりがない場合は、第三者がログインした可能性があります。
すぐにパスワードを変更し、お問い合わせフォームから運営までご連絡ください。
${siteUrl}/contact

Poker Summit運営事務局
※このメールは送信専用です。`;
  await sendEmail({ noreply: true, to: params.to, subject: "【Poker Summit】ログインのお知らせ", text });
}

/** メールアドレス登録・変更時の確認コード */
export async function sendEmailVerificationCode(params: { to: string; code: string; minutes: number }): Promise<void> {
  const text = `Poker Summit をご利用いただきありがとうございます。

店舗管理画面で、このメールアドレスを連絡先として登録する操作がありました。
次の確認コードを店舗管理画面に入力して、登録を完了してください。

■ 確認コード：${params.code}
（有効期限：${params.minutes}分）

この操作に心当たりがない場合は、このメールを破棄してください。登録は完了しません。

Poker Summit運営事務局
※このメールは送信専用です。`;
  await sendEmail({ noreply: true, sensitive: true, to: params.to, subject: "【Poker Summit】メールアドレスの確認コード", text });
}

/** 連絡先メールアドレスが変更されたことを、変更前のアドレスへ知らせる */
export async function sendContactEmailChangedNotice(params: { to: string; storeName: string; newEmail: string; at: Date }): Promise<void> {
  const siteUrl = getSiteUrl();
  const when = params.at.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const masked = params.newEmail.replace(/^(.).*(@.*)$/, "$1***$2");
  const text = `Poker Summit をご利用いただきありがとうございます。

${params.storeName} の連絡先メールアドレスが変更されました。

■ 日時：${when}（日本時間）
■ 変更後のアドレス：${masked}

今後のお知らせ・請求書は変更後のアドレスに届きます。
この変更に心当たりがない場合は、すぐにお問い合わせフォームから運営までご連絡ください。
${siteUrl}/contact

Poker Summit運営事務局
※このメールは送信専用です。`;
  await sendEmail({ noreply: true, to: params.to, subject: "【Poker Summit】連絡先メールアドレス変更のお知らせ", text });
}

/** カードの継続決済に失敗したときの店舗向け通知 */
export async function sendCardPaymentFailedEmail(params: {
  to: string;
  storeName: string;
  amount: number;
  suspendOn: string; // 掲載を止める予定日(YYYY/MM/DD)
}): Promise<void> {
  const siteUrl = getSiteUrl();
  const text = `${params.storeName} ご担当者様

Poker Summit をご利用いただきありがとうございます。

ご登録のクレジットカードで、掲載料金（${params.amount.toLocaleString("ja-JP")}円・税込）の決済ができませんでした。
カードの有効期限切れ・利用限度額などが考えられます。

お手数ですが、店舗管理画面の「プラン・お支払い」からカード情報をご登録し直してください。
${siteUrl}/store/profile/plan

決済は毎日自動で再試行します。${params.suspendOn} までに決済が確認できない場合、店舗ページの掲載を一時停止いたします（決済が確認でき次第、再開します）。

ご不明な点は、このメールへのご返信またはお問い合わせフォームからご連絡ください。
${siteUrl}/contact

Poker Summit運営事務局`;
  await sendEmail({ to: params.to, subject: "【Poker Summit】クレジットカード決済ができませんでした", text });
}

/** カードのまとめ払い(6か月・12か月)の自動更新の事前お知らせ(更新の7日前、2026/10/19) */
export async function sendPrepayRenewalNoticeEmail(params: {
  to: string;
  storeName: string;
  planName: string;
  months: number;
  amount: number;
  renewOn: string; // 更新日(YYYY年M月D日)
  deadline: string; // 変更・解約の連絡期限(更新日の前日)
}): Promise<void> {
  const siteUrl = getSiteUrl();
  const text = `${params.storeName} ご担当者様

Poker Summit をご利用いただきありがとうございます。

ご契約中の「${params.planName}（${params.months}か月まとめ払い）」は、${params.renewOn} に自動更新されます。
更新日に、ご登録のクレジットカードで ${params.amount.toLocaleString("ja-JP")}円（${params.months}か月分・税込）を決済します。

■ 引き続きご利用いただく場合
お手続きは不要です。

■ プラン・お支払い方法の変更、または解約をご希望の場合
${params.deadline} までに、お問い合わせフォームからご連絡ください。
${siteUrl}/contact

ご契約内容は店舗管理画面の「プラン・お支払い」から確認できます。
${siteUrl}/store/profile/plan

Poker Summit運営事務局`;
  await sendEmail({ to: params.to, subject: `【Poker Summit】${params.renewOn}にご契約が自動更新されます`, text });
}

/** カード決済が完了したことの店舗向けお知らせ(契約の更新・カード登録時の決済) */
export async function sendPaymentReceiptEmail(params: {
  to: string;
  storeName: string;
  amount: number;
  description: string; // 例: 「契約更新(ライトプラン)」
  periodEnd: string | null; // 次の契約期間の終わり(YYYY年M月D日)
  at: Date;
}): Promise<void> {
  const siteUrl = getSiteUrl();
  const when = params.at.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const text = `${params.storeName} ご担当者様

Poker Summit をご利用いただきありがとうございます。
ご登録のクレジットカードで、以下のとおり決済が完了しました。

■ 内容：${params.description}
■ 金額：${params.amount.toLocaleString("ja-JP")}円（税込）
■ 決済日時：${when}
${params.periodEnd ? `■ 次回の更新日：${params.periodEnd}\n` : ""}
決済の履歴やご契約内容は、店舗管理画面の「プラン・お支払い」でご確認いただけます。
${siteUrl}/store/profile/plan

心当たりのない決済の場合は、お問い合わせフォームからご連絡ください。
${siteUrl}/contact

Poker Summit運営事務局`;
  await sendEmail({ to: params.to, subject: "【Poker Summit】クレジットカード決済完了のお知らせ", text });
}

/** お支払いカードが登録・変更されたことのお知らせ */
export async function sendCardRegisteredEmail(params: { to: string; storeName: string; at: Date }): Promise<void> {
  const siteUrl = getSiteUrl();
  const when = params.at.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const text = `${params.storeName} ご担当者様

Poker Summit をご利用いただきありがとうございます。
お支払いに使うクレジットカードが登録（変更）されました。

■ 日時：${when}

次回以降の決済は、このカードで行います。
カード番号は決済代行会社（KOMOJU）が管理しており、Poker Summit には保存されません。

この操作に心当たりがない場合は、すぐにお問い合わせフォームからご連絡ください。
${siteUrl}/contact

Poker Summit運営事務局`;
  await sendEmail({ to: params.to, subject: "【Poker Summit】お支払いカード登録のお知らせ", text });
}

// ---------------------------------------------------------------------------
// 店舗データの自動見直し(毎日少しずつ・約1か月で全国1周)の結果を運営に知らせる(2026/10)
// ---------------------------------------------------------------------------
export async function sendStoreMaintenanceDigest(params: {
  to: string;
  approved: string[];
  held: { name: string; reason: string }[];
  closed: { name: string; status: string }[];
}): Promise<void> {
  const siteUrl = getSiteUrl();
  const lines: string[] = ["Poker Summit 店舗データの自動見直しの結果です。", ""];
  if (params.approved.length) {
    lines.push(`■ 新しく見つかり、Googleマップと照合して自動で掲載した店: ${params.approved.length}件`);
    for (const n of params.approved.slice(0, 50)) lines.push(`・${n}`);
    lines.push(`→ ${siteUrl}/admin/stores`, "");
  }
  if (params.held.length) {
    lines.push(`■ 新しく見つかったが、確認が必要なので承認待ちにした店: ${params.held.length}件`);
    for (const h of params.held.slice(0, 50)) lines.push(`・${h.name}(${h.reason})`);
    lines.push(`→ ${siteUrl}/admin/stores?status=pending`, "");
  }
  if (params.closed.length) {
    lines.push(`■ Googleで閉業・休業になった掲載店: ${params.closed.length}件`);
    for (const c of params.closed.slice(0, 50)) lines.push(`・${c.name}(${c.status === "CLOSED_PERMANENTLY" ? "閉業" : c.status === "CLOSED_TEMPORARILY" ? "休業" : "Googleから消えた"})`);
    lines.push(`→ ${siteUrl}/admin/stores/google-match`, "");
  }
  lines.push("Poker Summit");
  await sendEmail({
    to: params.to,
    subject: `【Poker Summit】店舗の自動見直し: 自動掲載${params.approved.length}件・確認待ち${params.held.length}件・閉業/休業${params.closed.length}件`,
    text: lines.join("\n"),
  });
}

/** パスワード再設定用リンク(「パスワードを忘れた方」から送る。会員・運営共通) */
export async function sendPasswordResetEmail(params: { to: string; link: string; minutes: number }): Promise<void> {
  const text = `Poker Summit をご利用いただきありがとうございます。

パスワード再設定のお申込みを受け付けました。
次のリンクを開いて、新しいパスワードを設定してください。

${params.link}

（有効期限：${params.minutes}分・1回のみ有効）

この操作に心当たりがない場合は、このメールを破棄してください。パスワードは変更されません。

Poker Summit運営事務局
※このメールは送信専用です。`;
  await sendEmail({ noreply: true, sensitive: true, to: params.to, subject: "【Poker Summit】パスワード再設定のご案内", text });
}

/** 振込の請求書がお支払期限を過ぎた翌日のお知らせ(猶予7日のうちに入金をお願いする、2026/10) */
export async function sendOverdueGraceNoticeEmail(params: {
  to: string;
  name: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  payBy: string;
  suspendOn: string;
}): Promise<void> {
  const siteUrl = getSiteUrl();
  const jp = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${y}年${Number(m)}月${Number(d)}日`;
  };
  const text = `${params.name} 様

いつもPoker Summitをご利用いただき、誠にありがとうございます。
請求書 ${params.invoiceNumber}（${params.amount.toLocaleString("ja-JP")}円）について、お支払期限（${jp(params.dueDate)}）を過ぎましたが、ご入金をまだ確認できておりません。

お手数ですが、${jp(params.payBy)}までにお振り込みをお願いいたします。
期日までにご入金が確認できない場合、${jp(params.suspendOn)}に店舗ページの公開を一時停止いたします（ご入金の確認後、公開を再開いたします）。

請求書・お振込先は店舗管理画面の「プラン・お支払い」からご確認いただけます。
${siteUrl}/store/profile/plan

行き違いでお振り込み済みの場合はご容赦ください。ご不明な点は、このメールへのご返信またはお問い合わせフォームからご連絡ください。
${siteUrl}/contact

Poker Summit運営事務局`;
  await sendEmail({ to: params.to, subject: `【Poker Summit】お支払期限を過ぎています（請求書 ${params.invoiceNumber}）`, text });
}

/** お問い合わせへの返信(総合管理の「お問い合わせ」から送る、2026/10)。返信を受けられるよう info@ から送る */
export async function sendInquiryReplyEmail(params: {
  to: string;
  name: string | null;
  subject: string | null;
  body: string;
  original: string;
  receivedAt: Date;
}): Promise<void> {
  const siteUrl = getSiteUrl();
  const when = params.receivedAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const quoted = params.original
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
  const text = `${params.name ? `${params.name} 様` : "お問い合わせいただいた方へ"}

${params.body}

Poker Summit運営事務局
${siteUrl}
ご不明な点は、このメールへのご返信でお問い合わせいただけます。

―――― お問い合わせ内容（${when}） ――――
${quoted}`;
  const subject = params.subject?.trim() ? `Re: ${params.subject.trim()}【Poker Summit】` : "【Poker Summit】お問い合わせへのご回答";
  await sendEmail({ to: params.to, subject, text });
}

/** 通報してくれた人への返信(総合管理の通報管理から、2026/10)。返信を受けられるよう info@ から送る */
export async function sendReportReplyEmail(params: { to: string; body: string; targetLabel: string }): Promise<void> {
  const siteUrl = getSiteUrl();
  const text = `Poker Summitをご利用いただきありがとうございます。
先日ご報告いただいた件（${params.targetLabel}）について、ご連絡いたします。

${params.body}

ご報告いただき、ありがとうございました。

Poker Summit運営事務局
${siteUrl}
ご不明な点は、このメールへのご返信でお問い合わせいただけます。`;
  await sendEmail({ to: params.to, subject: "【Poker Summit】ご報告いただいた件について", text });
}

/** 運営から店舗への個別のお知らせ(店舗管理の「運営からのお知らせ」にも残す。メールは info@ から) */
export async function sendStoreMessageEmail(params: { to: string; storeName: string; title: string; body: string }): Promise<void> {
  const siteUrl = getSiteUrl();
  const text = `${params.storeName} ご担当者様

いつもPoker Summitをご利用いただき、誠にありがとうございます。

${params.body}

この内容は店舗管理画面の「運営からのお知らせ」でもご確認いただけます。
${siteUrl}/store/profile/messages

ご不明な点は、このメールへのご返信またはお問い合わせフォームからご連絡ください。
${siteUrl}/contact

Poker Summit運営事務局`;
  await sendEmail({ to: params.to, subject: `【Poker Summit】${params.title}`, text });
}

/** 運営向けの警告(決済の結果不明・自動処理の失敗など)。site_settings.notify_email 宛て */
export async function sendAdminAlertEmail(params: { to: string; subject: string; lines: string[]; link?: string }): Promise<void> {
  const siteUrl = getSiteUrl();
  const text = [
    ...params.lines,
    "",
    params.link ? `確認する: ${siteUrl}${params.link}` : `確認する: ${siteUrl}/admin/billing/monitor`,
    "",
    "Poker Summit（自動送信）",
  ].join("\n");
  await sendEmail({ to: params.to, subject: `【Poker Summit 要確認】${params.subject}`, text });
}

/** 1日1回の新規会員まとめ(運営向け。site_settings.notify_email 宛て) */
export async function sendMemberDigestEmail(params: {
  to: string;
  dayLabel: string;
  members: Array<{ email: string; at: string; confirmed: boolean; mHoldemId?: string | null }>;
  total: number;
}): Promise<void> {
  const siteUrl = getSiteUrl();
  const lines = [
    `${params.dayLabel}の新規会員登録は ${params.members.length}人 でした（会員の合計 ${params.total}人）。`,
    "",
    ...params.members.map((m) => `・${m.at}  ${m.email}  m HOLD'EM ID: ${m.mHoldemId || "未登録"}${m.confirmed ? "" : "（メール未確認）"}`),
    "",
    "「メール未確認」は、登録後の確認メールのリンクをまだ押していない方です。",
    "",
    `会員の一覧: ${siteUrl}/admin/members`,
    "",
    "Poker Summit（自動送信。総合管理の「サイト設定」→ 通知設定で止められます）",
  ];
  await sendEmail({ to: params.to, subject: `【Poker Summit】${params.dayLabel}の新規会員登録 ${params.members.length}人（合計${params.total}人）`, text: lines.join("\n") });
}


/** 無料期間がもうすぐ終わることの店舗向けお知らせ(2026/10/20。終わる7日前に1回) */
export async function sendTrialEndingEmail(params: { to: string; storeName: string; planName: string; endOn: string; monthlyFee: number }): Promise<void> {
  const siteUrl = getSiteUrl();
  const text = `${params.storeName} ご担当者様

Poker Summit をご利用いただきありがとうございます。

${params.planName}の無料期間は、${params.endOn}までです。

■ 引き続きご利用いただく場合
店舗管理の「プラン・お支払い」から、お支払いに使うクレジットカードをご登録ください。
無料期間が終わった日に、月額${params.monthlyFee.toLocaleString("ja-JP")}円（税込）の決済を行い、そのまま続けてご利用いただけます。
銀行振込をご希望の場合は、運営までご連絡ください。
${siteUrl}/store/profile/plan

■ 続けない場合
お手続きは不要です。運営からご連絡いたします。

ご不明な点がございましたら、お問い合わせフォームよりご連絡ください。
${siteUrl}/contact

Poker Summit運営事務局`;
  await sendEmail({ to: params.to, subject: "【Poker Summit】無料期間終了のお知らせ", text });
}
