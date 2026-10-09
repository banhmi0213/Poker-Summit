import Link from "next/link";
import { submitApplication, startPaidApplication } from "./actions";
import { APPLY_CATEGORY_OPTIONS, PREF_OPTIONS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { staticPageMetadata } from "@/lib/seo";

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

  const [{ data: plans }, { data: addons }] = await Promise.all([
    supabase
      .from("plans")
      .select("id, name, monthly_fee, description")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("addons")
      .select("id, name, monthly_fee, description")
      .eq("active", true)
      .order("sort_order"),
  ]);

  if (!acceptingNew && !params.done) {
    return (
      <div>
        <PortalHeader />
        <div className="container" style={{ maxWidth: 480 }}>
          <Link href="/" className="breadcrumb">
            ← トップに戻る
          </Link>
          <div className="brand wordmark" style={{ marginBottom: 20 }}>
            <img className="logo-img" src="/images/logo.png" alt="Poker Summit" />
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

  if (params.done) {
    return (
      <div>
        <PortalHeader />
        <div className="container" style={{ maxWidth: 480 }}>
          <Link href="/" className="breadcrumb">
            ← トップに戻る
          </Link>
          <div className="brand wordmark" style={{ marginBottom: 20 }}>
            <img className="logo-img" src="/images/logo.png" alt="Poker Summit" />
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
          <img className="logo-img" src="/images/logo.png" alt="Poker Summit" />
        </div>
        <h1 style={{ fontSize: 20, marginBottom: 6 }}>掲載のお申込み</h1>
        <p className="muted" style={{ marginBottom: 20 }}>
          店舗・施設の掲載をご希望の方は、以下のフォームよりお申込みください。
        </p>
        <PricingSection plans={plans ?? []} addons={addons ?? []} />
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
              <div className="field">
                <span className="muted">
                  プランを選んでその場でお申込みの場合(クレジットカード登録へ進みます)
                </span>
                <select name="planId" defaultValue="">
                  <option value="">選択しない(まずは問い合わせのみ)</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}(月額{p.monthly_fee.toLocaleString()}円・税込)
                    </option>
                  ))}
                </select>
              </div>
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
                プランを選んでクレジットカード登録へ進む
              </button>
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
// 条件をここで明示する。価格と内容は管理画面のプラン/アドオン設定(plans/addons)から表示。
function PricingSection({ plans, addons }: { plans: PriceItem[]; addons: PriceItem[] }) {
  if (plans.length === 0 && addons.length === 0) return null;
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
          </div>
        );
      })}

      {addons.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>追加オプション</h3>
          {addons.map((addon) => (
            <div key={addon.id} style={{ padding: "8px 0", borderTop: "1px solid rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14 }}>{addon.name}</strong>
                <span style={{ fontWeight: 700 }}>
                  月額{yen(addon.monthly_fee)}
                  <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>（税込）</span>
                </span>
              </div>
              {addon.description && (
                <p className="muted" style={{ fontSize: 12.5, margin: "4px 0 0", lineHeight: 1.7 }}>
                  {addon.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ fontSize: 12.5, lineHeight: 1.8 }}>
        <h3 style={{ fontSize: 14, margin: "0 0 6px" }}>お支払いと契約について</h3>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>お支払いはクレジットカードによる月額の自動決済です。表示価格はすべて税込です。</li>
          <li>契約は1か月単位で自動更新します。月額料金はプラン料金と選択したオプション料金の合計です。</li>
          <li>プランのアップグレードやオプション追加はその場で決済し、ダウングレードやオプション解除は現在の契約期間の終了時に反映します。</li>
          <li>解約・自動更新の停止は、更新日前に<a href="/contact">お問い合わせフォーム</a>からご連絡ください。月額料金の日割り返金は原則行っておりません。</li>
          <li>当サービスは賭博・換金を目的とした決済は一切行いません。お支払いの対象は店舗掲載・広告・オプション等のサービス利用料金です。</li>
        </ul>
        <p style={{ margin: "8px 0 0" }}>
          詳しくは<a href="/tokushoho">特定商取引法に基づく表記</a>と<a href="/terms">利用規約</a>をご確認ください。
        </p>
      </div>
    </section>
  );
}
