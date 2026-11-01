import styles from "./learn.module.css";

export const advancedLevels = [
 {
  level: 3,
  name: "実戦チャレンジャー",
  theme: "基本を、実戦の判断につなげる",
  summary: "6レッスン・実戦判断テスト（12問）",
  prerequisite: "初心者コースの内容を理解した方",
  goal: "手札の強さだけでなく、相手のレンジと状況から行動の理由を説明できる。",
  lessons: [
   { title: "相手のハンドをレンジで考える", description: "ポジションとアクション履歴から、相手が持ち得るハンドの集合を考える。" },
   { title: "スタックとSPRを確認する", description: "有効スタックとポットに対する残りスタックの比率を知り、判断の前提をそろえる。" },
   { title: "ベットの目的とサイズを選ぶ", description: "バリュー・ブラフ・セミブラフを区別し、何をコールさせ、何を降ろしたいかを整理する。" },
   { title: "フロップの特徴とCベット", description: "ドライ・ウェットなどのボードの特徴を比較し、ベットとチェックの理由を考える。" },
   { title: "ターン・リバーの実戦判断", description: "追加カードでレンジがどう変わるかを追い、コール・フォールド・追加ベットを検討する。" },
   { title: "ハンド履歴から振り返る", description: "結果だけで良し悪しを決めず、各場面で分かっていた情報と判断の理由を記録する。" },
  ],
  assessment: "実戦判断テスト：場面ごとの行動と理由を選び、解説で判断の流れを確認する。",
 },
 {
  level: 4,
  name: "戦略マスター",
  theme: "期待値とGTOで、判断の根拠を深める",
  summary: "6レッスン・戦略・確率テスト（12問）",
  prerequisite: "Lv.3相当の実戦判断を学んだ方",
  goal: "GTOの考え方を理解し、ソルバーが示す頻度と期待値を区別して読める。",
  lessons: [
   { title: "勝率と期待値（EV）を区別する", description: "ポットオッズを復習し、フォールドさせる可能性も含めて行動の期待値を考える。" },
   { title: "コンボ数とブロッカー", description: "ハンドの組み合わせを数え、自分のカードが相手のバリュー・ブラフ候補に与える影響を学ぶ。" },
   { title: "GTOと混合戦略の基礎", description: "相手に対応されにくい戦略と、同じハンドでも複数の行動を一定の割合で選ぶ考え方を学ぶ。" },
   { title: "レンジ優位とナッツ優位", description: "レンジ全体の強さと最も強いハンドの多さを区別し、ボードごとの戦略の違いを比べる。" },
   { title: "ソルバー結果の読み方", description: "条件のそろった例題で、アクション頻度・サイズ・EV差を読み、頻度の低い選択を即座に誤りと決めつけない。" },
   { title: "GTOを実戦向けに整理する", description: "近いボードを比較して共通点を探し、EV差を確かめながら覚えやすい判断基準にまとめる。" },
  ],
  assessment: "戦略・確率の応用テスト：EV・コンボ・混合頻度とソルバーの出力を読み解く。",
 },
 {
  level: 5,
  name: "アカデミーエキスパート（仮）",
  theme: "条件を検証し、自分で戦略を組み立てる",
  summary: "ソルバー活用・相手への対応・総合演習",
  prerequisite: "Lv.4相当のGTOとソルバー読解を学んだ方",
  goal: "解析の前提と限界を説明し、実戦の記録から検証・改善の計画を立てられる。",
  lessons: [
   { title: "ソルバーの解析条件をそろえる", description: "人数・ポジション・レンジ・有効スタック・ポット・選択可能なベットサイズ・レーキなどを確認する。" },
   { title: "条件を変えて戦略を比較する", description: "スタックやサイズを一つずつ変え、出力の違いと計算精度を確認する。" },
   { title: "相手の傾向に合わせた調整", description: "十分な観察をもとにGTOからの調整を検討する。相手の行動を固定する解析と、読み違えた場合のリスクも学ぶ。" },
   { title: "複数ストリートの戦略をつなぐ", description: "フロップからリバーまでレンジを追い、バリューとブラフの候補、サイズの使い分けを検証する。" },
   { title: "トーナメント・多人数ポットへの応用", description: "チップ期待値とICMの違いを学び、リング・トーナメントや2人・多人数の解析結果をそのまま流用しない判断を身につける。" },
   { title: "実戦履歴の総合レビュー", description: "自分の判断を再現して解析と比較し、繰り返し起きる課題から次の練習テーマを決める。" },
  ],
  assessment: "総合上級チャレンジ：前提の設定・解析結果の解釈・実戦への調整・振り返りをまとめて確認する。",
 },
] as const;

export function LevelCurriculum({ onStartLevelThree, onStartLevelFour }: { onStartLevelThree?: () => void; onStartLevelFour?: () => void }) {
 return <div className={styles.curriculum}>
  <p className={styles.curriculumLead}>Lv.3の実戦判断、Lv.4のGTOの理解から、今後のソルバー活用へ。各レベルを開くと、学ぶ順番と到達目標を確認できます。</p>
  {advancedLevels.map(course => <details key={course.level} id={`academy-level-${course.level}`} className={styles.curriculumCard}>
   <summary className={styles.curriculumSummary}>
    <span className={styles.curriculumLevel}>Lv.{course.level}</span>
    <span className={styles.curriculumHeading}><strong>{course.name}</strong><span>{course.theme}</span></span>
    <span className={course.level < 5 ? styles.available : styles.planned}>{course.level < 5 ? "公開中" : "開発予定"}</span>
   </summary>
   <div className={styles.curriculumBody}>
    <dl className={styles.curriculumGoals}><div><dt>学習の目安</dt><dd>{course.prerequisite}</dd></div><div><dt>到達目標</dt><dd>{course.goal}</dd></div></dl>
    <ol className={styles.curriculumLessons}>{course.lessons.map(lesson => <li key={lesson.title}><strong>{lesson.title}</strong><p>{lesson.description}</p></li>)}</ol>
    {course.level === 3 && onStartLevelThree && <button type="button" className={styles.achievementAction} onClick={onStartLevelThree}>Lv.3を学ぶ</button>}
    {course.level === 4 && onStartLevelFour && <button type="button" className={styles.achievementAction} onClick={onStartLevelFour}>Lv.4を学ぶ</button>}
    <div className={styles.curriculumAssessment}><strong>最後に挑戦するテスト{course.level < 5 ? "" : "（予定）"}</strong><p>{course.assessment}</p></div>
   </div>
  </details>)}
  <p className={styles.achievementNote}>GTOはゲーム理論上の最適戦略、ソルバーは設定した条件のもとで戦略を解析するツールです。Lv.4の出力例は読み方を学ぶ教材用の架空データで、実際の解析結果ではありません。Lv.3・4の学習記録はブラウザ内に保存され、会員レベル・公式バッジには連動しません。Lv.5の教材や認定機能の提供時期は今後お知らせします。</p>
 </div>;
}
