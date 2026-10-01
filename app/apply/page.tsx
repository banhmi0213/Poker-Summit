import { submitApplication, startPaidApplication } from "./actions";
import { CATEGORY_OPTIONS, PREF_OPTIONS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

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

  const { data: plans } = await supabase
    .from("plans")
    .select("id, name, monthly_fee, description")
    .eq("active", true)
    .order("sort_order");

  if (!acceptingNew && !params.done) {
    return (
      <div className="container" style={{ maxWidth: 480, paddingTop: 60 }}>
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
    );
  }

  if (params.done) {
    return (
      <div className="container" style={{ maxWidth: 480, paddingTop: 60 }}>
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
    );
  }

  return (
    <div className="container" style={{ maxWidth: 480, paddingTop: 40 }}>
      <div className="brand wordmark" style={{ marginBottom: 20 }}>
        <img className="logo-img" src="/images/logo.png" alt="Poker Summit" />
      </div>
      <h1 style={{ fontSize: 20, marginBottom: 6 }}>掲載のお申込み</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        店舗・施設の掲載をご希望の方は、以下のフォームよりお申込みください。
      </p>
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
              {CATEGORY_OPTIONS.map((c) => (
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
                    {p.name}(月額{p.monthly_fee.toLocaleString()}円)
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
  );
}
