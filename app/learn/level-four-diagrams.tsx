import styles from "./level-four-diagrams.module.css";

const diagrams: Record<string, {title: string; note: string}> = {
 ev: {title:"勝つとき・負けるときの収支を足す",note:"例：元のポット1,000、コール額500、勝率35%。リバー・引き分け・レーキなし。判断時点のフォールドEVを0とします。"},
 combos: {title:"見えているAを、相手の候補から除く",note:"AAの組み合わせの例です。コンボ数は、相手がAAで参加・ベットする確率そのものではありません。"},
 mixing: {title:"100個の数字を、2つの行動に分ける",note:"ベット40%・チェック60%という教材用の仮定です。勝率や実際のGTO推奨値を示すものではありません。"},
 advantage: {title:"全体を見るか、強い部分を見るか",note:"概念図です。各段の幅や色は、実際のハンド数・エクイティ・頻度を表していません。"},
 solver: {title:"3つの数字は、それぞれ別の意味",note:"ソルバー形式の教材用架空データです。実際の解析結果や、実戦での推奨行動ではありません。"},
 application: {title:"条件・理由・検証を、1つの流れに",note:"対戦後の学習の流れです。次の履歴でも繰り返し、簡略化した戦略の影響は別途検証します。"},
};

function Aces({blocked = false}: {blocked?: boolean}) {
 return <div className={styles.cards} aria-label={blocked ? "Aスペードは除外。Aハート、Aダイヤ、Aクラブが残る" : "Aスペード、Aハート、Aダイヤ、Aクラブ"}>
  {["A♠","A♥","A♦","A♣"].map((card,i)=><span key={card} aria-hidden="true" className={`${styles.card} ${i===1||i===2?styles.redCard:""} ${blocked&&i===0?styles.blocked:""}`}>{card}</span>)}
 </div>;
}

function RangeLayers({topOnly = false}: {topOnly?: boolean}) {
 return <div className={`${styles.layers} ${topOnly?styles.topOnly:styles.wholeRange}`} aria-hidden="true"><span>強い部分</span><span>中くらいの部分</span><span>弱い部分</span></div>;
}

export function LevelFourDiagram({lessonId}: {lessonId: string}) {
 const diagram=diagrams[lessonId];
 if(!diagram)return null;
 return <figure className={styles.figure} aria-labelledby={`level4-diagram-${lessonId}`} data-lesson={lessonId}>
  <figcaption id={`level4-diagram-${lessonId}`} className={styles.heading}><span>図解</span><strong>{diagram.title}</strong></figcaption>
  {lessonId==="ev"&&<>
   <div className={styles.start}>コールする：追加で500チップ</div>
   <div className={styles.branch} aria-hidden="true"><i/><i/></div>
   <div className={styles.twoColumns}>
    <div className={`${styles.panel} ${styles.positive}`}><span className={styles.label}>勝つ確率 35%</span><strong>＋1,500</strong><small>元のポット＋相手のベット</small></div>
    <div className={`${styles.panel} ${styles.negative}`}><span className={styles.label}>負ける確率 65%</span><strong>−500</strong><small>今から払うコール額</small></div>
   </div>
   <div className={styles.result}><span>0.35 × 1,500 − 0.65 × 500</span><strong>EV ＝ ＋200チップ</strong></div>
  </>}
  {lessonId==="combos"&&<div className={styles.twoColumns}>
   <div className={styles.panel}><span className={styles.label}>除去する前</span><Aces/><p>4枚から2枚を選ぶ</p><strong>6コンボ</strong></div>
   <div className={styles.panel}><span className={styles.label}>自分がA♠を持つとき</span><Aces blocked/><p>残る3枚から2枚を選ぶ</p><strong>3コンボ</strong></div>
  </div>}
  {lessonId==="mixing"&&<>
   <div className={styles.start}>乱数 0〜99：100個を等確率で引く</div>
   <div className={styles.frequency} role="img" aria-label="0から39の40個をベット、40から99の60個をチェックに割り当てる"><div>40%</div><div>60%</div></div>
   <div className={styles.twoColumns}>
    <div className={styles.panel}><span className={styles.label}>0〜39を引いたら</span><strong>ベット</strong><small>40個の数字を割り当て</small></div>
    <div className={styles.panel}><span className={styles.label}>40〜99を引いたら</span><strong>チェック</strong><small>60個の数字を割り当て</small></div>
   </div><p className={styles.message}>「40%で選ぶ」と「40%で勝つ」は別のこと。</p>
  </>}
  {lessonId==="advantage"&&<div className={styles.twoColumns}>
   <div className={styles.panel}><span className={styles.label}>レンジ優位</span><RangeLayers/><strong className={styles.smallStrong}>レンジ全体を比較</strong><small>各候補の重みも含めた、平均的な強さを見る</small></div>
   <div className={styles.panel}><span className={styles.label}>ナッツ優位</span><RangeLayers topOnly/><strong className={styles.smallStrong}>最上位の分布を比較</strong><small>最強・それに近いハンドが、どちらに残るかを見る</small></div>
  </div>}
  {lessonId==="solver"&&<>
   <div className={styles.threeColumns}>
    <div className={styles.panel}><span className={styles.label}>頻度</span><strong>40%</strong><small>その行動を選ぶ割合</small></div>
    <div className={styles.panel}><span className={styles.label}>サイズ</span><strong>33% POT</strong><small>ポットに対するベット額</small></div>
    <div className={styles.panel}><span className={styles.label}>EV</span><strong>2.4 BB</strong><small>その行動の期待値</small></div>
   </div><p className={styles.message}>条件と単位を確認してから、同じ列どうしで比較。</p>
  </>}
  {lessonId==="application"&&<ol className={styles.steps}>
   {[{title:"履歴を選ぶ",text:"対戦後に、復習する場面を決める"},{title:"条件をそろえる",text:"人数・位置・スタック・サイズを確認"},{title:"理由を整理",text:"頻度・EVと行動の根拠を読む"},{title:"次の練習へ",text:"確かめる課題を1つ決める"}].map((step,i)=><li key={step.title}><span aria-hidden="true">{i+1}</span><strong>{step.title}</strong><small>{step.text}</small></li>)}
  </ol>}
  <p className={styles.note}>{diagram.note}</p>
 </figure>;
}
