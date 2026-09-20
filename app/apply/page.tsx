import { submitApplication } from "./actions";
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

  if (!acceptingNew && !params.done) {
    return (
      <div className="container" style={{ maxWidth: 480, paddingTop: 60 }}>
        <div className="brand" style={{ marginBottom: 20 }}>
          Poker Summit
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
        <div className="brand" style={{ marginBottom: 20 }}>
          Poker Summit
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
      <div className="brand" style={{ marginBottom: 20 }}>
        Poker Summit
      </div>
      <h1 style={{ fontSize: 20, marginBottom: 6 }}>掲載のお申込み</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        店舗・施設の掲載をご希望の方は、以下のフォームよりお申込みください。
      </p>
      <div className="card">
        {params.error && <p className="err">{params.error}</p>}
        <form action={submitApplication}>
          <div className="field">
            <span className="muted">会社名・屋号 *</span>
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
          <button
            type="submit"
            className="btn primary"
            style={{ width: "100%" }}
          >
            申込む
          </button>
        </form>
      </div>
    </div>
  );
}
