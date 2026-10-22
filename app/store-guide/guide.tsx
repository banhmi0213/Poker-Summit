import type { CSSProperties, ReactNode } from "react";

// 店舗管理ガイド(2026/10/22)。営業メールで送る非公開URLのページ(app/for-stores/guide-7kq3m9xw)と、
// 店舗管理の「店舗管理ガイド」(app/store/(authenticated)/profile/guide)で同じ中身を出す。
// 料金・機能は plans / addons の値(2026/10/22時点)に合わせている。変えたらここも直すこと。

const GOLD = "#9b7129";
const card: CSSProperties = { border: "1px solid #e4d3ad", borderRadius: 12, background: "#fffdf8", padding: "18px 20px", marginBottom: 16 };
const h2: CSSProperties = { fontSize: 18, margin: "0 0 4px", display: "flex", alignItems: "baseline", gap: 10 };
const path: CSSProperties = { fontSize: 12.5, color: "#7a6a52", margin: "0 0 12px" };
const ol: CSSProperties = { margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.9 };
const point: CSSProperties = { marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "#f6efe0", fontSize: 13, lineHeight: 1.7 };
const th: CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #e4d3ad", fontSize: 13, whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #efe5cf", fontSize: 13, verticalAlign: "top" };

function Section({ no, title, where, children, tip }: { no: string; title: string; where?: string; children: ReactNode; tip?: ReactNode }) {
  return (
    <section style={card} id={`s${no}`}>
      <h2 style={h2}>
        <span style={{ color: GOLD, fontSize: 14, fontWeight: 800 }}>{no}</span>
        {title}
      </h2>
      {where && <p style={path}>{where}</p>}
      {children}
      {tip && <div style={point}><strong style={{ color: GOLD }}>POINT</strong>　{tip}</div>}
    </section>
  );
}

const PLAN_ROWS: { label: string; light: string; standard: string; premium: string }[] = [
  { label: "月額（税込）", light: "5,500円", standard: "16,500円", premium: "33,000円" },
  { label: "店舗情報・写真・料金メニューの管理", light: "○", standard: "○", premium: "○" },
  { label: "トーナメント・イベント告知", light: "○", standard: "○", premium: "○" },
  { label: "クーポン・店舗のお知らせ", light: "○", standard: "○", premium: "○" },
  { label: "アクセス統計", light: "○", standard: "○", premium: "○" },
  { label: "LINEからの操作・通知", light: "○", standard: "○", premium: "○" },
  { label: "地域の店舗一覧での表示", light: "通常", standard: "上位表示", premium: "最上位表示・金枠" },
  { label: "スポット求人", light: "アドオンで1件ずつ", standard: "月10件の成立まで", premium: "無制限" },
  { label: "通常求人", light: "アドオンで掲載", standard: "アドオンで掲載", premium: "無制限" },
  { label: "ディーラースカウト", light: "アドオン（1人2,200円）", standard: "アドオン（1人2,200円）", premium: "アドオン（1人2,200円）" },
];

export function StoreGuide() {
  return (
    <div style={{ color: "#2d241a" }}>
      <section style={{ ...card, background: "linear-gradient(110deg,#fff9e8,#fffdf8)" }}>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.14em", color: GOLD, fontWeight: 800 }}>POKER SUMMIT / 店舗管理ガイド</p>
        <h1 style={{ fontSize: 22, margin: "6px 0 8px" }}>店舗管理ガイド</h1>
        <p style={{ fontSize: 14, lineHeight: 1.8, margin: 0 }}>
          ポーカーサミットの店舗管理画面の使い方をまとめています。はじめての方は、次の順番で設定してください。
        </p>
        <ol style={{ ...ol, marginTop: 10 }}>
          <li><a href="#s01">ログイン</a>：運営から届いた店舗用IDでログイン</li>
          <li><a href="#s02">店舗情報・写真</a>：営業時間・連絡先・店内写真を整える</li>
          <li><a href="#s04">料金・告知</a>：料金、イベント、クーポンを登録</li>
          <li><a href="#s07">求人・ディーラー募集</a>：求人・スポット求人を出して、応募を確認</li>
        </ol>
        <p style={{ fontSize: 12, color: "#7a6a52", margin: "10px 0 0", lineHeight: 1.7 }}>
          ご契約のプランによって、表示や利用できる機能が異なります（<a href="#s11">プランごとの機能</a>）。入力例はすべて例です。
        </p>
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 17, margin: "0 0 6px" }}>ご契約後の店舗ページのイメージ（サンプル）</h2>
        <p style={{ fontSize: 13.5, lineHeight: 1.8, margin: "0 0 10px" }}>
          店舗管理画面から写真・料金メニュー・クーポン・お知らせ・求人を登録すると、店舗ページはこのように表示されます。
        </p>
        <p style={{ fontSize: 13.5, lineHeight: 1.8, margin: "0 0 10px", padding: "8px 12px", background: "#fff6df", borderRadius: 8 }}>
          10月21日のプレオープン開始から1日足らずで、サイトは延べ<strong>1,000回以上</strong>・<strong>250人以上</strong>の方に閲覧されています（2026年10月22日時点）。
        </p>
        <img
          src="/store-guide/store-page-sample.png"
          alt="写真・料金メニュー・クーポン・お知らせを登録した店舗ページの表示例"
          width={865}
          height={863}
          style={{ width: "100%", height: "auto", borderRadius: 8, border: "1px solid #e4d3ad", display: "block" }}
        />
        <p style={{ fontSize: 12, color: "#7a6a52", margin: "8px 0 0" }}>※サンプルです。店名・住所・電話番号・写真は架空のものです。</p>
      </section>

      <section style={{ ...card, border: "2px solid #d9b45a", background: "linear-gradient(110deg,#fff6df,#fffdf8)" }}>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.14em", color: GOLD, fontWeight: 800 }}>DEALER SCOUT</p>
        <h2 style={{ fontSize: 18, margin: "4px 0 8px" }}>ディーラーが足りない日は、お店からスカウトできます</h2>
        <p style={{ fontSize: 14, lineHeight: 1.8, margin: "0 0 10px" }}>
          スポット求人を出して応募を待つだけでなく、ポーカーサミットに登録しているフリーディーラーをお店から探して、勤務をオファーできます。
        </p>
        <ul style={{ ...ol, marginBottom: 10 }}>
          <li>都道府県・勤務日・ゲーム種目で、条件に合うディーラーを探せます。</li>
          <li>プロフィール・他店からのレビュー・勤務実績を見てから声をかけられます。</li>
          <li>勤務日・時間・報酬はチャットで確認してから確定。成立すると、お互いの連絡先が表示されます。</li>
          <li>LINE連携していれば、返信やチャットのお知らせがLINEに届きます。</li>
        </ul>
        <p style={{ fontSize: 13.5, lineHeight: 1.8, margin: 0, padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid #e4d3ad" }}>
          <strong>料金：アドオン「ディーラースカウト」1人2,200円（税込）</strong>
          <br />
          どのプランでもご利用いただけます。オファーには、勤務日を登録したスポット求人が必要です（<a href="#s09">使い方</a>）。
        </p>
        <p style={{ fontSize: 12, color: "#7a6a52", margin: "8px 0 0" }}>※採用・勤務の成立を保証するものではありません。</p>
      </section>

      <Section no="01" title="ログインしてメニューを開く" where="https://pokersummit.jp/store/login" tip="店舗用のIDは会員用アカウントとは別です。IDやパスワードが分からない場合は、運営へお問い合わせください（パスワードは運営が発行します）。">
        <ol style={ol}>
          <li>店舗管理ログイン（https://pokersummit.jp/store/login）を開きます。</li>
          <li>お申し込み・発行時にお届けした店舗用のログインIDとパスワードを入力します。</li>
          <li>スマホでは「メニュー」を押すと項目が開きます。PCでは左側のメニューから操作します。</li>
        </ol>
      </Section>

      <Section no="02" title="店舗情報を更新する" where="メニュー → 店舗情報" tip="店舗名・住所の変更は、検索や地図に影響するため運営の承認後に反映されます。承認待ちの間は、その欄が編集できない表示になります。">
        <ol style={ol}>
          <li>店舗名・住所・最寄り駅・電話番号・営業時間を確認します。</li>
          <li>店舗紹介文、メール、LINE公式アカウント、X、InstagramのURLを入力します。検索キーワードには、地域名や特徴をスペース区切りで入力します。</li>
          <li>入力欄の下の「保存する」を押し、公開ページで内容を確認します。</li>
        </ol>
      </Section>

      <Section no="03" title="店舗写真を追加する" where="メニュー → 店舗情報 → 店舗写真ギャラリー（ページの下の方）" tip="写真を選ぶだけでは追加されません。「アップロードする」まで行ってください。上限は画面の「現在の枚数／上限枚数」で確認できます。">
        <ol style={ol}>
          <li>店舗情報のページを下に進め、店舗写真ギャラリーを開きます。</li>
          <li>外観・入口・店内の雰囲気が伝わる写真を選びます。お客様の顔や個人の連絡先が写っていないか確認してください。</li>
          <li>「アップロードする」を押し、一覧に追加されたことを確認します。</li>
        </ol>
      </Section>

      <Section no="04" title="料金・メニューを掲載する" where="メニュー → 料金・メニュー" tip="お客様が支払う金額と、適用される条件が分かる書き方にしましょう。">
        <ol style={ol}>
          <li>メニュー名（例：参加費）と料金（例：3,000円〜）を入力します。</li>
          <li>含まれるサービスや追加料金を説明欄に書きます（例：ドリンク1杯付き）。</li>
          <li>「追加する」を押します。変更は一覧の「編集」から行います。</li>
        </ol>
      </Section>

      <Section no="05" title="トーナメント・イベントを掲載する" where="メニュー → トーナメント・イベント" tip="日時は日本時間で入力します。開始・終了の両方を確認してください。">
        <ol style={ol}>
          <li>「新しいイベントを掲載する」を押します。</li>
          <li>トーナメント・イベント名、開催場所、開始・終了日時、詳細、カテゴリを入力します。必要に応じてバナー画像を選びます。</li>
          <li>「イベントを掲載する」を押し、掲載されたイベントを確認します。変更は該当イベントの編集欄から行います。</li>
        </ol>
      </Section>

      <Section no="06" title="クーポン・店舗のお知らせ" where="メニュー → クーポン ／ メニュー → 店舗のお知らせ" tip="クーポンには、対象の方・併用の条件・期限・利用上限を明記しましょう。">
        <ol style={ol}>
          <li>クーポン：タイトル・割引内容・説明・コード・期限・利用上限を入力し、必要なら画像を追加して「クーポンを発行する」を押します。</li>
          <li>店舗のお知らせ：タイトル・本文・画像を入力し、「お知らせを掲載する」を押します。</li>
          <li>お知らせは、一覧から編集や公開／非公開の切り替えができます。</li>
        </ol>
      </Section>

      <Section no="07" title="通常求人を掲載・応募を確認する" where="メニュー → 求人" tip="通常求人は、プレミアムプランでは無制限、ライト・スタンダードプランではアドオン「求人掲載1件」で掲載できます。掲載できない場合は「プラン・お支払い」でご確認ください。">
        <ol style={ol}>
          <li>画面上部で、契約プランと掲載できる求人の数を確認します。</li>
          <li>「新しい求人を掲載する」で、求人タイトル・雇用形態・給与・仕事内容を入力し、「求人を掲載する」を押します。</li>
          <li>「掲載した求人」から応募を確認します。採用が終わった求人は、募集状態を見直してください。</li>
        </ol>
      </Section>

      <Section no="08" title="スポット求人を登録する" where="メニュー → スポット求人" tip="終了時間が開始時間より早い場合は、翌日の時間として扱います。日付と時間を確認してください。応募や勤務の履歴がある求人の条件を変える場合は、新しい求人として登録します。">
        <ol style={ol}>
          <li>期間またはカレンダーで勤務日を選び、開始・終了時間、時給、人数を入力します。共通の条件を変えたら「選択した日に反映」を押します。</li>
          <li>種目・応募条件・交通費・服装・応募締切・契約形態・支払方法・支払日・合意事項を入力します。</li>
          <li>募集するなら「公開して保存」、準備中なら「下書き保存」を押します。登録後は、一覧からプレビュー・募集停止・勤務履歴・レビューの確認ができます。</li>
        </ol>
      </Section>

      <Section no="09" title="ディーラーとのマッチング（応募・オファー・勤務）" where="メニュー → スポット求人 → 応募・オファーのチャット／フリーディーラーを探す" tip="勤務条件はチャットで双方が確認してから確定します。成立すると、勤務に必要な連絡先がお互いに表示されます。">
        <ol style={ol}>
          <li><strong>応募を受ける</strong>：公開したスポット求人にディーラーが応募すると、「応募・オファーのチャット」に届きます（LINE連携していればLINEにも通知されます）。</li>
          <li><strong>オファーを出す</strong>：「フリーディーラーを探す」で都道府県・勤務日・ゲーム種目などから探し、「プロフィールを見る」→「勤務をオファーする」で声をかけられます（オファーにはスカウト枠を使います。足りない場合は「スカウト枠を購入する」から購入できます）。</li>
          <li><strong>条件を確定する</strong>：チャットで勤務日・時間・報酬などを確認し、双方が確定するとマッチング成立です。</li>
          <li><strong>勤務後</strong>：スポット求人の一覧の「勤務履歴・レビュー」から、勤務完了の確認とレビューを行います。</li>
        </ol>
      </Section>

      <Section no="10" title="LINEから操作する" where="メニュー → 店舗情報 → LINE連携" tip="LINE連携をすると、応募やチャットなどのお知らせもLINEに届きます。">
        <ol style={ol}>
          <li>店舗情報のページで「LINE連携コードを発行する」を押します。表示されたQRコードをスマホで読み取るか、LINEで店舗用ページを開いてコードを入力すると連携できます。</li>
          <li>連携後は、LINEから次の操作ができます：店舗基本情報（営業時間・電話番号・説明文など）、写真の追加・削除、イベント・クーポン・求人の作成・編集、スポット求人の応募・勤務管理、お知らせの作成・公開／非公開。</li>
        </ol>
      </Section>

      <Section no="11" title="プランごとの機能">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
            <thead>
              <tr>
                <th style={th}></th>
                <th style={th}>ライト</th>
                <th style={th}>スタンダード</th>
                <th style={th}>プレミアム</th>
              </tr>
            </thead>
            <tbody>
              {PLAN_ROWS.map((r) => (
                <tr key={r.label}>
                  <td style={{ ...td, fontWeight: 700 }}>{r.label}</td>
                  <td style={td}>{r.light}</td>
                  <td style={td}>{r.standard}</td>
                  <td style={td}>{r.premium}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12.5, color: "#7a6a52", lineHeight: 1.8, margin: "10px 0 0" }}>
          6か月まとめ払いは10%OFF、12か月まとめ払いは2か月分無料です。
          アドオン（追加オプション）は「プラン・お支払い」からお申し込みいただけます：求人掲載1件（月額8,800円）、スポット求人1件掲載（1件2,200円）、ディーラースカウト（1人2,200円）、地域PICKUP店舗表示、全国TOPページPICKUP店舗表示、TOPページバナー、店舗紹介記事・動画の作成など。料金はすべて税込です。
        </p>
      </Section>

      <Section no="12" title="日々の確認・困ったとき">
        <ul style={ol}>
          <li><strong>運営からのお知らせ</strong>：未読や重要な案内を確認します。</li>
          <li><strong>アクセス統計</strong>：店舗ページの閲覧状況を確認します。</li>
          <li><strong>プラン・お支払い</strong>：現在のプラン・アドオン・お支払いを確認します。</li>
          <li><strong>ログインできない</strong>：店舗用IDか、大文字・小文字を確認してください。</li>
          <li><strong>保存・掲載できない</strong>：必須項目、エラー表示、掲載枠・利用条件を確認してください。</li>
          <li><strong>変更がすぐ反映されない</strong>：店舗名・住所は承認待ちになっていないか確認してください。</li>
        </ul>
        <p style={{ fontSize: 13.5, lineHeight: 1.8, margin: "12px 0 0" }}>
          お問い合わせ：<a href="https://pokersummit.jp/contact">https://pokersummit.jp/contact</a>（店舗名・操作した項目・表示されたエラーをお知らせください）
        </p>
      </Section>
    </div>
  );
}
