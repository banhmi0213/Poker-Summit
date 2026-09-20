import { submitApplication } from "./actions";

const CATEGORY_OPTIONS = [
  { value: "amusement", label: "アミューズメントポーカー" },
  { value: "bar", label: "ポーカーバー" },
  { value: "casino", label: "カジノバー" },
  { value: "vip", label: "VIPルーム" },
  { value: "mahjong", label: "麻雀併設" },
  { value: "tournament", label: "トーナメント会場" },
  { value: "school", label: "ポーカースクール" },
  { value: "ladies", label: "レディース" },
];

const PREF_OPTIONS = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

export default function ApplyPage({
  searchParams,
}: {
  searchParams: { error?: string; done?: string };
}) {
  const params = searchParams;

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
