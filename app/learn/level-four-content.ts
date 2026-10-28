import type { LevelThreeLesson, PracticeQuestion } from "./level-three-content";

export const levelFourLessons: readonly LevelThreeLesson[] = [
 {
  id: "ev", title: "勝率と期待値（EV）を区別する", subtitle: "勝つ確率だけでなく、払う額と受け取る額を見る", goal: "判断時点からの収支を使い、コールとフォールドの期待値を比較できる。",
  sections: [
   { title: "EVは1回の結果ではなく、平均の収支", text: "期待値（EV）は、各結果の収支に起こる確率を掛けて足した値です。勝率が高いほど有利になりやすいものの、いくら払って何を得るかを無視できません。勝率40%でも安いコールなら利益的な場合があり、同じ勝率でも大きいベットに対しては結論が変わることがあります。すでにポットへ投入した額は、今から選ぶ行動の追加コストとは分けます。" },
   { title: "コールEVの計算をそろえる", text: "リバーで相手のベット前のポットをP、ベット額と自分のコール額をB、勝率をqとします。引き分け・レーキなしなら、勝ったときの純増はP＋B、負けたときの損失はB。コールEVはq×(P＋B)−(1−q)×Bです。この時点のフォールドEVを0として比較します。自分のコール分を勝ちの利益に二重計上しません。" },
   { title: "フォールドさせる可能性も利益になる", text: "コールされたら必ず負ける純粋なブラフを考えます。元のポットPにBを打ち、相手がfの確率で降りるなら、EVはf×P−(1−f)×Bです。必要なフォールド率はB÷(P＋B)。ただし、相手が本当にその割合で降りるかは別の検討です。将来のベット、引き分け、ドローの改善を含む実戦では、この簡単な式だけで判断しません。" },
  ],
  takeaway: "必要勝率は価格の基準、実際の勝率は相手レンジへの見積もり。EVはそれらを収支に結びつける。",
  questions: [
   { id: "l4-ev-p1", topic: "コールEV", situation: "リバー。元のポット1,000、相手のベット500、勝率35%。引き分け・レーキなし。", question: "フォールドを0としたコールEVは？", choices: ["＋200チップ", "＋700チップ", "−200チップ"], answer: 0, explanation: "0.35×1,500−0.65×500＝＋200です。自分がコールする500は勝ったときの純利益には含めません。" },
   { id: "l4-ev-p2", topic: "純粋なブラフ", situation: "元のポット1,000に500ベット。コールされたら必ず負け、相手は降りるかコールするだけと仮定。", question: "損益分岐となるフォールド率は？", choices: ["50%", "約33.3%", "25%"], answer: 1, explanation: "500÷(1,000＋500)≒33.3%。相手がその割合より多く降りるなら、この仮定でブラフEVはプラスです。" },
  ],
 },
 {
  id: "combos", title: "コンボ数とブロッカー", subtitle: "カードの組み合わせを、見えている情報で数え直す", goal: "ペア・スーテッド・オフスートのコンボ数とカード除去の影響を説明できる。",
  sections: [
   { title: "AAは6、AKsは4、AKoは12コンボ", text: "カードが何も除かれていないとき、同じランクのペアは4枚から2枚を選ぶので6通りです。異なるランクで同じスートなら4通り、異なるスートなら4×3＝12通りです。AK全体では16通り。コンボ数を数えると、ハンド名を1種類ずつ数えるだけでは見えない候補の量を比較できます。" },
   { title: "見えているカードは相手に配られない", text: "自分がA♠を持っていれば、相手のAAは残るA3枚から2枚を選ぶ3通りになります。AKsはA♠K♠が消えて3通り、AKoは9通りです。さらにK♦も見えていれば、それらを使う候補も除きます。公開ボードのカードも同様ですが、ここでの操作演習はプリフロップの自分の手札だけを扱います。" },
   { title: "コンボ数と実際の頻度は別", text: "候補が多いからといって、その全コンボが同じ割合で参加・ベットするとは限りません。ブロッカーで相手の強い候補を減らしても、同時にブラフや降りる候補を減らす場合があります。「Aを持つから必ずブラフ」という決め方ではなく、どの候補を除いているかを両側から考えます。" },
  ],
  takeaway: "物理的に残る組み合わせを数えた後、その候補が実際にその行動を取る割合を考える。",
  questions: [
   { id: "l4-combos-p1", topic: "コンボ", situation: "自分の手札やボードによる除去をまだ考えない状態です。", question: "AKsとAKoのコンボ数は？", choices: ["どちらも4", "AKs 12、AKo 4", "AKs 4、AKo 12"], answer: 2, explanation: "同じスートの組み合わせは4通り、異なるスートは4×3＝12通りです。" },
   { id: "l4-combos-p2", topic: "カード除去", situation: "プリフロップで自分がA♠を持っています。ほかのAは見えていません。", question: "相手のAAは何コンボ残る？", choices: ["6", "3", "1"], answer: 1, explanation: "相手に使えるAは3枚。3枚から2枚を選ぶので3コンボです。" },
  ],
 },
 {
  id: "mixing", title: "GTOと混合戦略の基礎", subtitle: "選ぶ割合と、勝つ確率を混同しない", goal: "GTOの前提と、同じハンドで複数の行動を混ぜる意味を説明できる。",
  sections: [
   { title: "GTOは、条件のある戦略の考え方", text: "GTO（ゲーム理論上の最適戦略）は、相手が対応してきても一方的に利用されにくい戦略を考える枠組みです。ヘッズアップのゼロサムのモデルと、レーキ・複数人数・賞金構造のあるゲームを同じものとして扱うことはできません。毎回勝つ保証でも、相手のすべてのミスから最大利益を得る戦略でもありません。" },
   { title: "混合頻度は、何回その行動を選ぶか", text: "ある条件でチェック60%、ベット40%と示される場合、それは同じ条件を繰り返したときの行動割合です。「ベットすると40%勝つ」という意味ではありません。理想的な均衡で同じハンドが混ぜて使う行動のEVは等しくなります。実際の解析には近似・収束誤差・丸めがあるので、小さな数字の差を過大に解釈しないようにします。" },
   { title: "乱数は、その場の気分の代わり", text: "0〜99の乱数で、0〜39ならベット、40〜99ならチェックと割り当てれば、各数字が同じ確率で出るとき40%・60%を実行できます。ただし10回だけでは4回・6回にならないこともあります。演習の比率は読み方を学ぶための仮定です。実戦でどの手札をどれだけ混ぜるかは、この演習からは分かりません。" },
  ],
  takeaway: "アクション頻度・ハンドの勝率・EVは別の数字。低い頻度で使う行動も、それだけで誤りとは限らない。",
  questions: [
   { id: "l4-mixing-p1", topic: "頻度", situation: "同じ条件で、あるハンドのベット頻度が40%と表示されています。", question: "何を意味する数字？", choices: ["ベットしたときの勝率が40%", "ポットの40%を必ず打つ", "その条件でベットを選ぶ割合が40%"], answer: 2, explanation: "頻度は行動を選ぶ割合です。勝率やベットサイズとは別の情報です。" },
   { id: "l4-mixing-p2", topic: "乱数", situation: "0〜99を等確率で引き、0〜39をベットに割り当てました。", question: "乱数が40なら？", choices: ["チェック", "ベット", "もう一度引いて都合のよい数を選ぶ"], answer: 0, explanation: "40はチェック側の40〜99に含まれます。毎回引き直してベットを選ぶと、決めた割合を実行できません。" },
  ],
 },
 {
  id: "advantage", title: "レンジ優位とナッツ優位", subtitle: "全体の強さと、最上位の強さを分けて比べる", goal: "レンジ全体の比較と最上位ハンドの分布が、別の情報だと理解する。",
  sections: [
   { title: "レンジ全体の比較", text: "相手のレンジに対する平均的なエクイティなどで、どちらのレンジが全体として強いかを比較します。特定の1ハンドだけが強くても、レンジ全体が優位とは限りません。参加・継続の頻度によって各コンボの重みも変わります。レンジ優位があるから全ハンドで必ずベットできる、という意味でもありません。" },
   { title: "ナッツ優位は、上位ハンドの分布", text: "最強、またはそれに近い強いハンドがどちらに多く残っているかを見る考え方です。平均的には弱い側でも、最上位の役を一方だけが多く持つ場合があります。ナッツ優位という言葉の使い方には幅があるので、実際にはストレート・セットなど何を比較しているかを明確にします。" },
   { title: "席名だけで結論を固定しない", text: "同じUTG対BBでも、ボードのつながりやスート、プリフロップのサイズ、誰がどこでコールしたかで残る候補は変わります。強い候補を両者から挙げ、ボードに合わない候補や除去されたカードも確認しましょう。正確なエクイティやベット戦略は、範囲と頻度をそろえた解析が必要です。" },
  ],
  takeaway: "全体のエクイティと最上位ハンドの分布を別々に確認する。どちらか1つだけで最適サイズは決まらない。",
  questions: [
   { id: "l4-advantage-p1", topic: "優位の区別", situation: "A側のレンジは平均的に強い一方、最上位の役はB側に多いと分かりました。", question: "どう理解する？", choices: ["平均と最上位は別で、異なる側が優位になる場合もある", "必ずA側にナッツも多い", "B側が全ハンドで必ず勝つ"], answer: 0, explanation: "レンジ全体の強さと、最上位の分布は別の軸です。同じ側が両方で優位とは限りません。" },
   { id: "l4-advantage-p2", topic: "判断の前提", situation: "『この席が常にレンジ優位』という説明だけを聞きました。", question: "追加で確認すべきものは？", choices: ["相手の服装だけ", "ボード、参加レンジ、頻度、サイズ、スタックなど", "前回の勝敗だけ"], answer: 1, explanation: "同じ席順でもボードや前の行動でレンジは変わります。条件をそろえて比較します。" },
  ],
 },
 {
  id: "solver", title: "ソルバー結果の読み方", subtitle: "前提・サイズ・頻度・EVを順に確認する", goal: "ソルバー形式の出力例で、頻度とEV、解析条件の違いを区別できる。",
  sections: [
   { title: "結果より先に条件を見る", text: "形式、人数、ポジション、有効スタック、ボード、両者のレンジ、ポット、レーキ、選べるサイズを確認します。違うサイズが許されていれば別のゲームツリーになるため、出力も変わり得ます。チップEVの解析を、ICMの影響するトーナメント終盤にそのまま当てはめないことも大切です。" },
   { title: "頻度・サイズ・EVの列を分ける", text: "頻度40%は、その行動を選ぶ割合。33% POTは、ポットに対するベット額。EV 2.4BBは、その行動の期待値です。ツールごとにEVの基準点や単位が異なることもあるため、同じ表の中で、同じ基準の数値を比較します。頻度が最も高い行動が、必ず唯一の正解とは限りません。" },
   { title: "小差と、大きな損失を分ける", text: "EVがほぼ同じ選択肢の小さな丸め差を追うより、明らかにEVが低い選択肢を繰り返していないかを確認します。ただし近いEVだからどんな頻度変更も安全、というわけではありません。混ぜ方を変えた後に相手が対応すれば、利益が変わる可能性があります。次のレッスンでは学習上の整理方法を扱います。" },
  ],
  takeaway: "条件をそろえ、単位と基準を確認してから数字を読む。頻度の低さを、そのままEV損失と読み替えない。",
  questions: [
   { id: "l4-solver-p1", topic: "出力の読み方", situation: "教材用の架空出力：チェック60%・EV2.4BB、33% POTベット40%・EV2.4BB。", question: "読み取れることは？", choices: ["チェックは60%の確率で勝つ", "この例では両行動のEV表示が同じで、頻度が異なる", "40%ベットは必ず誤り"], answer: 1, explanation: "頻度とEVは別です。この例は読み方の教材で、実際の手札に対する解析結果ではありません。" },
   { id: "l4-solver-p2", topic: "条件", situation: "自分の実戦は40BB、見ている解析は100BBです。", question: "適切な扱いは？", choices: ["同じ手札なら必ず同じ戦略", "その解析の勝率だけで決める", "条件が違うと認識し、対応する解析を確認する"], answer: 2, explanation: "有効スタックが変わると戦略やサイズの関係も変わります。異なる条件の出力をそのまま正解にしません。" },
  ],
 },
 {
  id: "application", title: "GTOを実戦向けに整理する", subtitle: "数字の暗記から、理由を持った復習へ", goal: "条件の近い例を比べ、検証可能な練習テーマを立てられる。",
  sections: [
   { title: "まず、繰り返す場面を選ぶ", text: "全ハンドを暗記しようとせず、同じポジション・スタック・ポット形式の場面を集めます。例えば2人のシングルレイズポットを、3ベットポットや多人数と混ぜずに比べます。レンジ全体と代表的なハンドを見て、なぜその選択肢が使われるのかを言葉にします。" },
   { title: "簡略化は、別の戦略への変更", text: "サイズを減らす、複雑な混合を整理するなどは、覚えやすくする方法です。ただし元の解析で2行動のEVが近いからといって、全レンジを一律に片方へ寄せても安全とは限りません。変更した戦略への相手の対応を含めて再検証が必要です。簡略化と、相手の傾向を狙うエクスプロイトは目的も区別しましょう。" },
   { title: "実戦の後に検証する", text: "自分の履歴から条件を再現し、誤って読んだ列や大きなEV差のある判断を整理します。対戦中のリアルタイム支援には使わず、利用する卓や大会のルールに従って学習しましょう。Lv.4では出力の読解までを扱い、解析の作成や相手の行動を固定した比較はLv.5で扱う予定です。" },
  ],
  takeaway: "同じ条件で比較し、根拠を短く説明して、次回試す手順を1つ決める。簡略化の安全性は別途確かめる。",
  questions: [
   { id: "l4-application-p1", topic: "簡略化", situation: "いくつかのハンドでチェックとベットのEV差が小さく見えます。", question: "どの考え方が適切？", choices: ["全レンジを常にベットしても必ず安全", "混合戦略は常に不要", "戦略変更への相手の対応も含めて検証する"], answer: 2, explanation: "表示EVは元の戦略に対する値です。頻度を一律に変えた後も同じEVが保たれるとは限りません。" },
   { id: "l4-application-p2", topic: "復習", situation: "ソルバー形式の表で、頻度と勝率を混同していました。", question: "次の具体的な練習は？", choices: ["同じ条件の例で、頻度・サイズ・EVの列を説明する", "数字を見ずに常にオールイン", "対戦中に毎回解析して答えを確認する"], answer: 0, explanation: "混同した項目を限定して、対戦後に出力を読み直します。毎回勝つことより、再現できる理解の手順を目標にします。" },
  ],
 },
];

export const LEVEL_FOUR_PASS_SCORE = 10;
export const LEVEL_FOUR_STORAGE_KEY = "poker-summit-academy-level4-v1";
export const levelFourExam: readonly PracticeQuestion[] = [
 {id:"l4-exam-ev1",topic:"期待値",situation:"リバー。元のポット800、相手が400ベット。勝率25%、引き分け・レーキなし。",question:"コールEVは？",choices:["＋400", "0", "−400"],answer:1,explanation:"0.25×1,200−0.75×400＝0。この条件でコールとフォールドは同じEVです。"},
 {id:"l4-exam-ev2",topic:"ブラフEV",situation:"ポット1,000に1,000の純粋なブラフ。相手は60%フォールド、残りはコールし、コールされたら必ず負けると仮定。",question:"このベットのEVは？",choices:["＋200", "＋600", "−200"],answer:0,explanation:"0.6×1,000−0.4×1,000＝＋200です。これは相手の反応を仮定した計算です。"},
 {id:"l4-exam-combos1",topic:"コンボ",situation:"自分の手札A♠ K♦が見えています。まだボードはありません。",question:"相手のAKsは何コンボ？",choices:["4", "3", "2"],answer:2,explanation:"A♠K♠とA♦K♦は使えません。残る同スートはA♥K♥とA♣K♣の2コンボです。"},
 {id:"l4-exam-combos2",topic:"ブロッカー",situation:"あるカードが、相手のバリュー候補とブラフ候補の両方を減らします。",question:"考えるべきことは？",choices:["バリューを減らせば必ず有利", "どの候補をどれだけ除き、相手の行動割合にどう影響するか", "すべての候補が同じ頻度で動くと仮定すれば十分"],answer:1,explanation:"バリューだけでなく、ブラフやフォールド候補の除去も重要です。物理的な数と行動頻度を分けます。"},
 {id:"l4-exam-mixing1",topic:"混合戦略",situation:"理想的な均衡で、同じハンドがチェックとベットを混ぜて使っています。",question:"両行動のEVについての基本的な理解は？",choices:["理想的には等しいが、実際の近似出力では誤差も確認する", "頻度が高い側だけ必ず高い", "頻度が低い側は必ずマイナス"],answer:0,explanation:"理想的な均衡で正の頻度を持つ行動は無差別です。実際のソルバーは近似なので精度や丸めも見ます。"},
 {id:"l4-exam-mixing2",topic:"頻度",situation:"20%ベットを乱数0〜99のうち0〜19に割り当てます。",question:"乱数19と20の割り当ては？",choices:["両方ベット", "19はチェック、20はベット", "19はベット、20はチェック"],answer:2,explanation:"0〜19は20個で20%。境界の20はチェック側です。短期間の実績が必ず20%になるとは限りません。"},
 {id:"l4-exam-advantage1",topic:"レンジ",situation:"自分の1ハンドは相手に非常に強いと分かりました。",question:"それだけでレンジ全体の優位も分かる？",choices:["必ず分かる", "ほかの候補と重みも比べないと分からない", "レンジ優位は手札と無関係"],answer:1,explanation:"1ハンドの強さと、レンジ全体の平均的な強さは別です。各候補をその頻度も含めて比較します。"},
 {id:"l4-exam-advantage2",topic:"ナッツ優位",situation:"ボード上の最強に近いハンドが、どちらのレンジに多く残るかを調べます。",question:"主に何を見ている？",choices:["ナッツ優位", "プレイヤーの総チップ順位", "前のハンドの勝敗"],answer:0,explanation:"最上位ハンドの分布を見る考え方です。これだけでベットサイズが自動的に決まるわけではありません。"},
 {id:"l4-exam-solver1",topic:"出力読解",situation:"教材の表に「頻度30%」「サイズ75% POT」「EV1.8BB」とあります。",question:"正しい読み方は？",choices:["勝率30%、ベット額1.8BB", "75%の確率で勝ち、30% POTを打つ", "選ぶ割合30%、ベット額はポットの75%、期待値1.8BB"],answer:2,explanation:"アクション頻度、ポット比のサイズ、BB単位の期待値は別の列です。"},
 {id:"l4-exam-solver2",topic:"解析条件",situation:"レーキありの実戦と、レーキなしの出力を比較します。",question:"必要な注意は？",choices:["常に完全一致する", "条件差を確認し、結果を無条件に流用しない", "手札のスートだけ合えばよい"],answer:1,explanation:"レーキを含む条件が違えばEVや戦略が変わることがあります。条件と単位を確認して読みます。"},
 {id:"l4-exam-application1",topic:"整理",situation:"元の解析では2つのサイズが使われています。覚えやすくするため1つに減らしたいと思いました。",question:"適切な手順は？",choices:["目的を決め、変更後の戦略も検証する", "単に頻度の低いサイズをすべて消せば損失ゼロ", "すべての条件で同じサイズを使えばGTOになる"],answer:0,explanation:"許されるサイズと頻度の変更は戦略を変えます。元の出力のEVがそのまま保たれるとは限りません。"},
 {id:"l4-exam-application2",topic:"学習",situation:"次の復習に向け、参考にする履歴を選びます。",question:"比較しやすい集め方は？",choices:["2人と多人数、40BBと100BBを無条件に混ぜる", "結果が勝ったハンドだけにする", "ポジション・スタック・ポット形式などの条件をそろえる"],answer:2,explanation:"条件の近い履歴を集めると、戦略の共通点と違いを検討しやすくなります。勝敗だけで選別しません。"},
];

export type LevelFourProgress = { completed: string[]; bestScore: number | null };
export function parseLevelFourProgress(raw: string | null): LevelFourProgress {
 const empty: LevelFourProgress = {completed: [], bestScore: null};
 if (!raw) return empty;
 try {
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== "object" || Array.isArray(data)) return empty;
  const value = data as {completed?: unknown; bestScore?: unknown};
  return {completed: Array.isArray(value.completed) ? [...new Set(value.completed.filter((id): id is string => typeof id === "string" && levelFourLessons.some(l => l.id === id)))] : [], bestScore: typeof value.bestScore === "number" && Number.isInteger(value.bestScore) && value.bestScore >= 0 && value.bestScore <= levelFourExam.length ? value.bestScore : null};
 } catch { return empty; }
}
export function scoreLevelFour(answers: readonly number[]) {return levelFourExam.reduce((sum,q,i)=>sum+(answers[i]===q.answer?1:0),0);}

export function expectedValues(pot: number, bet: number, equityPercent: number, foldPercent: number) {
 if (![pot,bet,equityPercent,foldPercent].every(Number.isFinite) || pot<=0 || bet<=0 || equityPercent<0 || equityPercent>100 || foldPercent<0 || foldPercent>100) return null;
 const q=equityPercent/100, f=foldPercent/100;
 return {callEv:q*(pot+bet)-(1-q)*bet,bluffEv:f*pot-(1-f)*bet,requiredEquity:bet/(pot+2*bet)*100,requiredFolds:bet/(pot+bet)*100};
}
export type ComboHand = "AA" | "AKs" | "AKo";
export function remainingCombos(hand: ComboHand, dead: readonly string[] = []) {
 const suits=["s","h","d","c"];
 const aces=suits.map(s=>"A"+s).filter(c=>!dead.includes(c));
 const kings=suits.map(s=>"K"+s).filter(c=>!dead.includes(c));
 if(hand==="AA") return aces.flatMap((a,i)=>aces.slice(i+1).map(b=>[a,b]));
 return aces.flatMap(a=>kings.filter(k=>hand==="AKs"?a[1]===k[1]:a[1]!==k[1]).map(k=>[a,k]));
}
export function mixedAction(draw: number, betPercent: number): "bet" | "check" | null {
 if(!Number.isInteger(draw)||draw<0||draw>99||!Number.isInteger(betPercent)||betPercent<0||betPercent>100)return null;
 return draw<betPercent?"bet":"check";
}
export const outputExamples = [
 {id:"mixed",label:"混合の例",rows:[{action:"チェック",frequency:60,ev:2.4},{action:"33% POTベット",frequency:40,ev:2.4}],note:"EVの表示は同じで、選ぶ頻度は異なります。低い頻度を選んだから損失が大きいとは言えません。"},
 {id:"difference",label:"EV差のある例",rows:[{action:"チェック",frequency:0,ev:1.2},{action:"33% POTベット",frequency:0,ev:1.7},{action:"75% POTベット",frequency:100,ev:2.5}],note:"この架空出力の基準では75% POTベットのEVが最大です。チェックとの差は1.3BB。現実のどの手札にも当てはまる指示ではありません。"},
] as const;
