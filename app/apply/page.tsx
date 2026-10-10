import Link from "next/link";
import { submitApplication, startPaidApplication } from "./actions";
import { APPLY_CATEGORY_OPTIONS, PREF_OPTIONS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { staticPageMetadata } from "@/lib/seo";
import { BILLING_CYCLES, discountFor, getBillingSettings, quote, type BillingSettings } from "@/lib/bank-transfer";

export const metadata = staticPageMetadata({ title: "店舗掲載のお申し込み", description: "アミューズメントポーカー店・ポーカーバーの掲載お申し込み。Poker Summitに店舗情報・イベント・求人を掲載して集客につなげましょう。", path: "/apply" });

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: { error?: string; done?: string };
}) {
  const params = searchParams;

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("site_settings")
    .select("listing_accept_new")
    .eq("id", true)
    .maybeSingle();
  const acceptingNew = settings?.listing_accept_new ?? true;
  const billing = await getBillingSettings();

  const { data: plans } = await supabase
    .from("plans")
    .select("id, name, monthly_fee, description")
    .eq("active", true)
    .order("sort_order");

  if (!acceptingNew && !params.done) {
    return (
      <div>
        <PortalHeader />
        <div className="container" style={{ maxWidth: 480 }}>
          <Link href="/" className="breadcrumb">
            ← トップに戻る
          </Link>
          <div className="brand wordmark" style={{ marginBottom: 20 }}>
            <img className="logo-img" src="/images/logo.webp" alt="Poker Summit" />
          </div>
          <div className="card">
            <h1 style={{ fontSize: 18, marginBottom: 8 }}>
              現在、掲載申込の受付を停止しております
            </h1>
            <p className="muted">
              大変申し訳ございませんが、現在新規の掲載申込を一時的に停止しております。再開時期はお問い合わせよりご確認ください。
            </p>
            <a href="/" className="btn" style={{ marginTop: 16, display: "inline-flex" }}>
              トップへ戻る
            </a>
          </div>
        </div>
        <PortalFooter />
        <BottomTabs />
      </div>
    );
  }

  if (params.done === "transfer") {
    return (
      <div>
        <PortalHeader />
        <div className="container" style={{ maxWidth: 480 }}>
          <Link href="/" className="breadcrumb">
            ← トップに戻る
          </Link>
          <div className="brand wordmark" style={{ marginBottom: 20 }}>
            <img className="logo-img" src="/images/logo.webp" alt="Poker Summit" />
          </div>
          <div className="card">
            <h1 style={{ fontSize: 18, marginBottom: 8 }}>お申込みありがとうございます</h1>
            <p style={{ fontSize: 14, lineHeight: 1.8 }}>
              ご登録のメールアドレスに<strong>請求書（PDF）</strong>をお送りしました。
              請求書に記載のお支払期限（{billing.dueDays}日以内）までに、下記口座へお振り込みください。
            </p>
            {billing.bank && (
              <div className="card" style={{ background: "var(--surface-2)", margin: "12px 0", fontSize: 14, lineHeight: 1.8 }}>
                <div className="muted" style={{ fontSize: 12 }}>お振込先</div>
                <div>{billing.bank.bank} {billing.bank.branch}</div>
                <div>{billing.bank.type} {billing.bank.number}</div>
                <div>口座名義：{billing.bank.holder}</div>
              </div>
            )}
            <ul className="muted" style={{ fontSize: 12.5, lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
              <li>振込手数料はお客様のご負担でお願いいたします。</li>
              <li>ご入金を確認でき次第、店舗管理アカウントを発行し、ログイン情報をメールでお送りします。</li>
              <li>メールが届かない場合は迷惑メールフォルダをご確認のうえ、info@pokersummit.jp までご連絡ください。</li>
            </ul>
            <a href="/" className="btn" style={{ marginTop: 16, display: "inline-flex" }}>
              トップへ戻る
            </a>
          </div>
        </div>
        <PortalFooter />
        <BottomTabs />
      </div>
    );
  }

  if (params.done) {
    return (
      <div>
        <PortalHeader />
        <div className="container" style={{ maxWidth: 480 }}>
          <Link href="/" className="breadcrumb">
            ← トップに戻る
          </Link>
          <div className="brand wordmark" style={{ marginBottom: 20 }}>
            <img className="logo-img" src="/images/logo.webp" alt="Poker Summit" />
          </div>
          <div className="card">
            <h1 style={{ fontSize: 18, marginBottom: 8 }}>
              お申込みありがとうございます
            </h1>
            <p className="muted">
              掲載申込を受け付けました。内容を確認のうえ、担当者よりご連絡いたします。
            </p>
            <a href="/" className="btn" style={{ marginTop: 16, display: "inline-flex" }}>
              トップへ戻る
            </a>
          </div>
        </div>
        <PortalFooter />
        <BottomTabs />
      </div>
    );
  }

  return (
    <div>
      <PortalHeader />
      <div className="container" style={{ maxWidth: 480 }}>
        <Link href="/" className="breadcrumb">
          ← トップに戻る
        </Link>
        <div className="brand wordmark" style={{ marginBottom: 20 }}>
          <img className="logo-img" src="/images/logo.webp" alt="Poker Summit" />
        </div>
        <h1 style={{ fontSize: 20, marginBottom: 6 }}>掲載のお申込み</h1>
        <p className="muted" style={{ marginBottom: 20 }}>
          店舗・施設の掲載をご希望の方は、以下のフォームよりお申込みください。
        </p>
        <PricingSection plans={plans ?? []} billing={billing} />
        <h2 style={{ fontSize: 16, margin: "24px 0 10px" }}>お申込みフォーム</h2>
        <div className="card">
          {params.error && <p className="err">{params.error}</p>}
          <form action={submitApplication}>
            <div className="field">
              <span className="muted">店舗名・会社名 *</span>
              <input type="text" name="companyName" required />
            </div>
            <div className="field">
              <span className="muted">ご担当者名 *</span>
              <input type="text" name="contactName" required />
            </div>
            <div className="field">
              <span className="muted">電話番号</span>
              <input type="tel" name="tel" />
            </div>
            <div className="field">
              <span className="muted">メールアドレス *</span>
              <input type="email" name="email" required />
            </div>
            <div className="field">
              <span className="muted">都道府県</span>
              <select name="pref" defaultValue="">
                <option value="">選択してください</option>
                {PREF_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <span className="muted">カテゴリ</span>
              <select name="category" defaultValue="">
                <option value="">選択してください</option>
                {APPLY_CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <span className="muted">お問い合わせ内容</span>
              <textarea name="message" rows={4} />
            </div>

            {plans && plans.length > 0 && (
              <>
                <div className="field">
                  <span className="muted">プランを選んでお申込みの場合</span>
                  <select name="planId" defaultValue="">
                    <option value="">選択しない(まずは問い合わせのみ)</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}(月額{p.monthly_fee.toLocaleString()}円・税込)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <span className="muted">お支払い方法</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                      <input type="radio" name="billingMethod" value="bank_transfer" defaultChecked />
                      銀行振込（請求書払い）
                    </label>
                    {billing.cardPaymentEnabled && (
                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                        <input type="radio" name="billingMethod" value="card" />
                        クレジットカード（毎月の自動決済）
                      </label>
                    )}
                  </div>
                </div>
                <div className="field">
                  <span className="muted">お支払いサイクル（銀行振込の場合）</span>
                  <select name="billingCycle" defaultValue="1">
                    {BILLING_CYCLES.map((m) => {
                      const d = discountFor(billing, m);
                      const label = quote(0, m, d).label;
                      return (
                        <option key={m} value={m}>
                          {m === 1 ? "毎月払い" : `${m}か月まとめ払い${label ? `（${label}）` : ""}`}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </>
            )}

            <button
              type="submit"
              formAction={submitApplication}
              className="btn"
              style={{ width: "100%", marginBottom: 8 }}
            >
              問い合わせのみ送る(担当者より連絡)
            </button>
            {plans && plans.length > 0 && (
              <button
                type="submit"
                formAction={startPaidApplication}
                className="btn primary"
                style={{ width: "100%" }}
              >
                選んだプランで申し込む
              </button>
            )}
            {plans && plans.length > 0 && (
              <p className="muted" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.7 }}>
                銀行振込の場合は、お申込み後に請求書（PDF）をメールでお送りします。ご入金の確認後に店舗管理アカウントを発行します。
                {billing.cardPaymentEnabled ? "クレジットカードの場合はカード登録画面へ進みます。" : ""}
              </p>
            )}
          </form>
        </div>
      </div>
      <PortalFooter />
      <BottomTabs />
    </div>
  );
}

type PriceItem = { id: string; name: string; monthly_fee: number; description: string | null };

const LINK_STYLE = { textDecoration: "underline", textUnderlineOffset: 3, fontWeight: 600 } as const;

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

function featureLines(description: string | null) {
  return (description ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

// 掲載を希望する店舗向けの料金説明。このページはフッターの「掲載希望の店舗様へ」からのみ
// 辿れる店舗向けページで、一般会員向けのナビには出さない。決済審査では「販売する
// サービスと価格が確認できること」が求められるため、内容・税込価格・請求と解約の
// 条件をここで明示する。プランの価格と内容は管理画面の設定から表示。追加オプションは店舗管理画面で案内。
function PricingSection({ plans, billing }: { plans: PriceItem[]; billing: BillingSettings }) {
  const prepay = BILLING_CYCLES.filter((m) => m !== 1).map((m) => ({ months: m, discount: discountFor(billing, m) }));
  if (plans.length === 0) return null;
  return (
    <section aria-labelledby="pricing-heading" style={{ marginBottom: 8 }}>
      <h2 id="pricing-heading" style={{ fontSize: 16, margin: "0 0 4px" }}>
        店舗様向け 料金プラン
      </h2>
      <p className="muted" style={{ fontSize: 12.5, margin: "0 0 12px", lineHeight: 1.7 }}>
        掲載をご希望の店舗・事業者様向けの有料プランです。一般会員の方は無料でご利用いただけます。
      </p>

      {plans.map((plan) => {
        const features = featureLines(plan.description);
        return (
          <div className="card" key={plan.id} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <h3 style={{ fontSize: 15, margin: 0 }}>{plan.name}</h3>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 18 }}>
                月額{yen(plan.monthly_fee)}
                <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>（税込）</span>
              </p>
            </div>
            {features.length > 0 && (
              <ul style={{ margin: "10px 0 0", paddingLeft: 20, fontSize: 13.5, lineHeight: 1.8 }}>
                {features.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.08)", fontSize: 12.5, lineHeight: 1.8 }}>
              {prepay.map(({ months, discount }) => {
                const q = quote(plan.monthly_fee, months, discount);
                return (
                  <div key={months} style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                    <span>
                      {months}か月まとめ払い
                      {q.label && (
                        <span className="badge" style={{ marginLeft: 6, fontSize: 10.5 }}>
                          {q.label}
                        </span>
                      )}
                    </span>
                    <span>
                      {q.discountAmount > 0 && (
                        <s className="muted" style={{ marginRight: 6 }}>{yen(q.gross)}</s>
                      )}
                      <strong>{yen(q.total)}</strong>
                      <span className="muted">（税込）</span>
                    </span>
                    {discount && (
                      <span className="muted" style={{ width: "100%", fontSize: 11.5, marginTop: -2 }}>
                        {discount.type === "free_months"
                          ? `${months - discount.value}か月分の料金で${months === 12 ? "1年間" : `${months}か月間`}掲載`
                          : `1か月あたり${yen(Math.floor(q.total / months))}`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="card" style={{ fontSize: 12.5, lineHeight: 1.8 }}>
        <h3 style={{ fontSize: 14, margin: "0 0 6px" }}>お支払いと契約について</h3>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>表示価格はすべて税込です。お支払いは銀行振込（請求書払い）{billing.cardPaymentEnabled ? "またはクレジットカードによる月額の自動決済" : ""}です。</li>
          <li>銀行振込は「毎月払い」または「6か月・12か月のまとめ払い」をお選びいただけます。まとめ払いの割引は上記のとおりです。振込手数料はお客様のご負担となります。</li>
          <li>銀行振込の場合、お申込み後に請求書（適格請求書）をメールでお送りします。お支払期限は請求書の発行から{billing.dueDays}日以内です。ご入金の確認後に掲載を開始します。</li>
          <li>契約はお選びいただいた期間ごとに自動更新します。銀行振込の場合は契約期間が終わる7日前に次回分の請求書をお送りします。お支払期限までにご入金が確認できない場合、期限の翌日に店舗ページの公開を停止し、ご入金の確認後に再開します。</li>
          {billing.cardPaymentEnabled && (
            <li>クレジットカードの場合、プランのアップグレードはその場で決済し、ダウングレードは現在の契約期間の終了時に反映します。</li>
          )}
          <li>解約・自動更新の停止は、更新日前に<a href="/contact" style={LINK_STYLE}>お問い合わせフォーム</a>からご連絡ください。お支払い済みの料金（まとめ払いを含む）の日割り・月割りでの返金は原則行っておりません。</li>
          <li>当サービスは賭博・換金を目的とした決済は一切行いません。お支払いの対象は店舗掲載・広告・オプション等のサービス利用料金です。</li>
        </ul>
        <p style={{ margin: "8px 0 0" }}>
          詳しくは<a href="/tokushoho" style={LINK_STYLE}>特定商取引法に基づく表記</a>と<a href="/terms" style={LINK_STYLE}>利用規約</a>をご確認ください。
        </p>
      </div>
    </section>
  );
}
