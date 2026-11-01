import styles from "./level-four-diagrams.module.css";

const content: Record<string, { title: string; note: string; panels: readonly { label: string; value: string; detail: string }[] }> = {
 ranges: { title: "1つに決めず、候補を分ける", note: "候補は説明用です。参加・ベットする割合や網羅的なレンジを示していません。チェックでも強い役は残り得ます。", panels: [
  { label: "ボード", value: "A♣ 7♦ 2♠", detail: "相手がプリフロップでレイズし、フロップでベット" },
  { label: "強い候補", value: "AA・77・22", detail: "セットの候補" },
  { label: "ほかの候補", value: "AK・KK・KQ", detail: "トップペア・下のペア・ノーペアも検討" },
 ] },
 spr: { title: "小さい側の残りスタックでSPRを計算", note: "2人でフロップのベット前に比較した例です。SPRだけでオールインの可否は決まりません。", panels: [
  { label: "自分の残り", value: "8,000", detail: "相手と今後取り合える額は3,000まで" },
  { label: "相手の残り", value: "3,000", detail: "残り有効スタックは小さい側の3,000" },
  { label: "現在のポット", value: "1,000", detail: "SPR ＝ 3,000 ÷ 1,000 ＝ 3" },
 ] },
 betting: { title: "ベットの目的を3つに整理", note: "どの目的でも必ず利益が出るわけではありません。相手の候補・反応と、ベットサイズを合わせて検討します。", panels: [
  { label: "バリュー", value: "弱い役にコール", detail: "自分より弱いハンドからチップを得たい" },
  { label: "ブラフ", value: "強い役を降ろす", detail: "自分より強いハンドのフォールドを狙う" },
  { label: "セミブラフ", value: "フォールド＋改善", detail: "ドローで打ち、コールされても改善の可能性がある" },
 ] },
 flop: { title: "カードのつながりとスートを見比べる", note: "ボードだけで有利な側や最適サイズは決まりません。参加レンジ・人数・ポジションも確認し、チェックも検討します。", panels: [
  { label: "ランクが離れる", value: "A♠ 7♦ 2♣", detail: "スートもばらばら。強いドローは比較的少ない" },
  { label: "つながりが強い", value: "J♠ T♠ 9♦", detail: "KQはストレート。スペード2枚の手札にはフラッシュドロー" },
  { label: "ペアがある", value: "8♥ 8♣ 3♦", detail: "8を持てばトリップス、33ならフルハウス" },
 ] },
 streets: { title: "追加カードごとに判断を更新する", note: "自分の手札はQ♠ J♠。改善しても必勝とは限りません。相手の候補・ベット額・残りスタックも毎回見直します。", panels: [
  { label: "1 フロップ", value: "T♠ 9♦ 2♣", detail: "8かKでストレート。まだ完成していない" },
  { label: "2 ターン", value: "8♣", detail: "Qハイのストレートが完成" },
  { label: "3 リバー", value: "2♦", detail: "ボードがペアに。相手のフルハウスなども検討" },
 ] },
 review: { title: "勝敗と判断の良し悪しを分けて振り返る", note: "対戦後の復習用です。後で見えた相手の手札を、判断時に分かっていた情報と混同しないようにしましょう。", panels: [
  { label: "1 状況を記録", value: "その時の情報", detail: "人数・席順・ボード・スタック・ベット額" },
  { label: "2 理由を比較", value: "選択と別案", detail: "なぜその行動か、ほかの選択肢は何か" },
  { label: "3 次回の練習", value: "目標を1つ", detail: "例：コール前に必要勝率を計算する" },
 ] },
};

export function LevelThreeDiagram({ lessonId }: { lessonId: string }) {
 const diagram = content[lessonId];
 if (!diagram) return null;
 const titleId = `level3-diagram-${lessonId}`;
 return <figure className={styles.figure} aria-labelledby={titleId} data-lesson={lessonId}>
  <figcaption className={styles.heading} id={titleId}><span>図解</span><strong>{diagram.title}</strong></figcaption>
  <div className={styles.threeColumns}>{diagram.panels.map(panel => <div className={styles.panel} key={panel.label}><span className={styles.label}>{panel.label}</span>{/[♠♥♦♣]/.test(panel.value) ? <div className={styles.cards}>{panel.value.split(" ").map(card => <span key={card} className={`${styles.card} ${/[♥♦]/.test(card) ? styles.redCard : ""}`}>{card}</span>)}</div> : <strong className={styles.smallStrong}>{panel.value}</strong>}<p>{panel.detail}</p></div>)}</div>
  <p className={styles.note}>{diagram.note}</p>
 </figure>;
}
