export type PracticeQuestion = {
 id: string;
 topic: string;
 situation: string;
 question: string;
 choices: readonly string[];
 answer: number;
 explanation: string;
};

export type LevelThreeLesson = {
 id: string;
 title: string;
 subtitle: string;
 goal: string;
 sections: readonly { title: string; text: string }[];
 takeaway: string;
 questions: readonly PracticeQuestion[];
};

export const levelThreeLessons: readonly LevelThreeLesson[] = [
 {
  id: "ranges", title: "相手のハンドをレンジで考える", subtitle: "1つの手札を当てるより、候補を整理する",
  goal: "相手の席順・行動・ボードから、複数のハンド候補を考えられる。",
  sections: [
   { title: "レンジは、持ち得るハンドの集合", text: "相手がレイズしたときに「きっとAA」と決めつけると、別のハンドを持つ可能性を見落とします。強いペア、強いAハイ、スーテッドハンドなど、複数の候補から考えましょう。同じレイズでも、参加人数・ポジション・サイズ・有効スタックによって想定は変わります。" },
   { title: "行動のたびに候補を見直す", text: "プリフロップで参加した候補のうち、フロップのベットに続けそうなのはどれでしょうか。トップペアだけでなく、セット、ドロー、ブラフ候補も分けて考えます。「チェックしたから弱い」「大きく打ったから強い」とは限りません。最初から1つに絞らず、相手のプレイ傾向も参考にします。" },
   { title: "カードが見えたら、候補の中身が変わる", text: "同じ参加レンジでも、Aのあるボードと低いカードが並ぶボードでは、できる役が異なります。自分の手札と公開カードに含まれるカードは、相手の手札には存在できません。見えていないカードを後から知ったつもりで判断せず、その場で分かる情報だけで候補を更新します。" },
  ],
  takeaway: "相手の手札を断定せず、強いハンド・中程度のハンド・ドロー・ブラフの候補を残す。",
  questions: [
   { id: "ranges-practice-1", topic: "レンジ", situation: "6人卓。UTGが最初にレイズし、あなたはBTNで判断しています。相手の手札は見えていません。", question: "最初の考え方として適切なのは？", choices: ["相手はAAと断定する", "UTGの参加候補とサイズから複数のハンドを考える", "レイズした人は全員同じレンジと考える"], answer: 1, explanation: "席順と行動は候補を考える材料です。AAも候補になり得ますが、情報だけで1つの手札に確定はできません。" },
   { id: "ranges-practice-2", topic: "レンジの更新", situation: "相手がフロップでチェックしました。まだショーダウンしていません。", question: "チェックから必ず言えることは？", choices: ["セットは絶対にない", "必ずノーペア", "強いハンドも残り得るので候補を見直す"], answer: 2, explanation: "強いハンドでもチェックすることがあります。チェックだけで強い候補をすべて除くと、相手のレンジを狭めすぎます。" },
  ],
 },
 {
  id: "spr", title: "スタックとSPRを確認する", subtitle: "ポットに対して、あと何倍のチップが残っているか",
  goal: "2人のポットで有効スタックとSPRを計算し、判断の前提を説明できる。",
  sections: [
   { title: "有効スタックは、相手と取り合える上限", text: "ヘッズアップで残りスタックが自分8,000、相手3,000なら、今後相手と取り合えるのはそれぞれ3,000までです。すでにポットに入った額と、手元に残るスタックを分けて確認しましょう。多人数ポットでは相手ごとに有効スタックが変わり、サイドポットもあるため、この2人用の計算をそのまま当てはめません。" },
   { title: "SPR ＝ 残り有効スタック ÷ 現在のポット", text: "フロップのベットが始まる前、ポット1,000に対して残り有効スタック3,000ならSPRは3です。比べるタイミングをそろえることが大切です。ベットとコールが入ればポットが増え、残りスタックも減るのでSPRは変化します。" },
   { title: "SPRは、即オールインの指示ではない", text: "SPRが小さければ残りチップを入れるまでのベット回数は少なくなりますが、「SPRが低いからどんなワンペアでもオールイン」とは言えません。ボード、相手のレンジ、必要勝率も確認します。SPRは判断に使う条件の1つです。" },
  ],
  takeaway: "同じ時点のポットと残りスタックを使い、2人なら小さい側の残りスタックで計算する。",
  questions: [
   { id: "spr-practice-1", topic: "有効スタック", situation: "2人でフロップへ。ベット前の残りは自分8,000、相手3,000、ポット1,000です。", question: "この時点のSPRは？", choices: ["3", "8", "11"], answer: 0, explanation: "残り有効スタックはmin(8,000, 3,000)＝3,000。SPRは3,000÷1,000＝3です。" },
   { id: "spr-practice-2", topic: "SPRの解釈", situation: "SPRが1の場面で、あなたはワンペアを持っています。相手のレンジはまだ検討していません。", question: "この情報だけで決められることは？", choices: ["必ずオールインが正解", "必ずフォールドが正解", "SPRだけでは決められず、ボードや相手も確認する"], answer: 2, explanation: "低いSPRでも、相手の強さや勝率の検討は必要です。SPRはオールインを自動で選ぶルールではありません。" },
  ],
 },
 {
  id: "betting", title: "ベットの目的とサイズを選ぶ", subtitle: "どのハンドにコールされ、何を降ろしたいか",
  goal: "バリュー・ブラフ・セミブラフを区別し、サイズによって相手の必要勝率が変わると理解する。",
  sections: [
   { title: "勝っている相手から受け取る、降ろして獲得する", text: "バリューベットでは、自分より弱いハンドからコールされることを狙います。ブラフでは、自分より強いハンドをフォールドさせることが利益につながります。ただ「強いから打つ」「弱いから打つ」ではなく、相手のどの候補が反応するかまで考えます。" },
   { title: "ドローで打つセミブラフ", text: "ドローでベットすると、相手が降りて今のポットを得る可能性と、コールされても後で強い役になる可能性があります。これがセミブラフの考え方です。ドローがあるだけでベットが必ず得になるわけではなく、相手が降りる見込みと、完成しても負ける可能性を確認します。" },
   { title: "サイズは、目的とレンジに合わせる", text: "大きなベットは相手に高い勝率を要求する一方、ブラフが失敗したときの損失も大きくなります。小さなベットには弱いハンドも続けやすくなりますが、実際の反応は相手次第です。すべてのボード・ハンドで同じサイズを正解にするのではなく、目的に沿って比較しましょう。" },
  ],
  takeaway: "ベット前に「弱い候補からコールを取るのか、強い候補を降ろすのか」を言葉にする。",
  questions: [
   { id: "betting-practice-1", topic: "ベットの目的", situation: "リバーで強い役を持ち、相手の弱い役からコールをもらうためにベットします。", question: "この目的は？", choices: ["ブラフ", "バリュー", "セミブラフ"], answer: 1, explanation: "自分より弱いハンドからコールを得る狙いはバリューです。リバーでは追加カードがないので、未完成のドローによるセミブラフではありません。" },
   { id: "betting-practice-2", topic: "サイズと必要勝率", situation: "元のポット1,000に500ベットしました。相手は500をコールすると、合計2,000のポットを争います。", question: "将来のベットやレーキを無視した、相手の必要勝率は？", choices: ["50%", "33.3%", "25%"], answer: 2, explanation: "相手のコール500÷最終ポット2,000＝25%です。相手が実際に持つ勝率や反応は、この数字だけでは分かりません。" },
  ],
 },
 {
  id: "flop", title: "フロップの特徴とCベット", subtitle: "自分の手札だけでなく、ボードと両者のレンジを見る",
  goal: "ボードの特徴を比較し、Cベットを自動で打たずに理由を考える。",
  sections: [
   { title: "Cベットとは何か", text: "プリフロップで最後にレイズしたプレイヤーが、フロップでもベットする行動をコンティニュエーションベット（Cベット）と呼びます。レイズした人の義務ではありません。チェックしてショーダウンを目指す、相手のベットを受けるなど、別の進め方もあります。" },
   { title: "ドライ・ウェットを観察する", text: "A♠ 7♦ 2♣のようにランクが離れてスートもばらばらなボードは、多くの強いドローができるJ♠ T♠ 9♦と特徴が異なります。後者ではストレート・フラッシュのドローや強い完成役が関わります。ペアボードではフルハウスなどの可能性も意識しましょう。" },
   { title: "ボードだけでサイズを決めない", text: "「Aハイなら必ず小さく打つ」「ウェットなら必ず大きく打つ」という決まりではありません。誰がどこから参加したか、2人か多人数か、相手にポジションがあるかで判断は変わります。チェックの選択肢も残し、相手にコール・レイズされた後の計画を考えます。" },
  ],
  takeaway: "ボードのランク・スート・つながり・ペアを観察した後、両者のレンジと人数を合わせて考える。",
  questions: [
   { id: "flop-practice-1", topic: "ボードの特徴", situation: "A♠ 7♦ 2♣ と J♠ T♠ 9♦ の2つのフロップを比べます。", question: "J♠ T♠ 9♦で特に意識する点は？", choices: ["どちらも必ず同じレンジが有利", "ストレートやフラッシュのドローが関わりやすい", "誰にも強いハンドはできない"], answer: 1, explanation: "ランクがつながり、同じスートが2枚あるため、多様なドローが生まれます。ただし、どちらが有利かは参加レンジなども確認しないと決まりません。" },
   { id: "flop-practice-2", topic: "Cベット", situation: "プリフロップで最後にレイズしたあなたに、フロップで相手がチェックしました。", question: "Cベットを打つべきか考えるときの姿勢は？", choices: ["両者のレンジとボードを見て、チェックも検討する", "必ず打つ", "自分の手札にペアがなければ必ず諦める"], answer: 0, explanation: "Cベットは強制ではありません。レンジ・人数・位置・サイズを考慮し、チェックを含めた選択肢を検討します。" },
  ],
 },
 {
  id: "streets", title: "ターン・リバーの実戦判断", subtitle: "追加カードごとに、前の計画を更新する",
  goal: "ターンとリバーで役・ドロー・相手の候補が変わることを説明できる。",
  sections: [
   { title: "ターンで確認する3つのこと", text: "自分が改善したか、相手の候補が改善したか、残りスタックに対してポットがどれだけ大きいかを確認します。フロップでベットしたからといって、そのまま打ち続ける必要はありません。ドローが完成するカード、ボードがペアになるカードには特に注意します。" },
   { title: "完成確率と勝率は同じではない", text: "フラッシュドローが完成しても、相手がより高いフラッシュやフルハウスを持てば負けます。逆にドローが完成しなくても、もとのペアで勝つ場合もあります。アウト数の簡単な計算は便利ですが、コール判断では相手のレンジに対して勝てる確率を考える必要があります。" },
   { title: "リバーでは追加カードを待てない", text: "リバーでは手札がこれ以上改善しません。バリューを取れる弱い候補と、ブラフで降ろせる強い候補を整理し直します。相手のベットに対しては必要勝率と想定レンジを比較します。実戦では相手の手札は未知なので、結果を知ってから判断を正当化しないようにしましょう。" },
  ],
  takeaway: "新しいカードが出るたびに見直す。ドロー完成だけで勝利を決めつけず、リバーでは追加の改善がないことを意識する。",
  questions: [
   { id: "streets-practice-1", topic: "追加カード", situation: "Q♠ J♠を持ち、ボードはT♠ 9♦ 2♣ 3♥ K♦になりました。", question: "自分の最強の役は？", choices: ["フラッシュ", "ストレート（9・T・J・Q・K）", "ワンペア"], answer: 1, explanation: "手札のQ・Jとボードの9・T・KでKハイのストレートです。スートが5枚そろっていないのでフラッシュではありません。" },
   { id: "streets-practice-2", topic: "リバーの判断", situation: "リバーでドローが完成しませんでした。相手はチェックしています。", question: "ベットするかを考えるときに必要なのは？", choices: ["次のカードで改善する可能性", "ドローが外れたので必ずブラフ", "相手のどの候補を降ろせるか、チェックより期待値が高いか"], answer: 2, explanation: "リバーで追加カードは出ません。外れたドローすべてをブラフにせず、相手の候補とサイズ、チェックの価値も比較します。" },
  ],
 },
 {
  id: "review", title: "ハンド履歴から振り返る", subtitle: "勝ったかではなく、何を根拠に選んだか",
  goal: "判断時の情報を再現し、結果と判断を分けて次の練習課題を作れる。",
  sections: [
   { title: "まず、場面を再現する", text: "形式、人数、ブラインド、席順、有効スタック、自分の手札、公開カード、各ストリートのポットとベット額を記録します。レーキやアンティなどのルールも解析の前提になります。後から分かった相手の手札は、判断時に見えていた情報と区別して書きます。" },
   { title: "理由と別の選択肢を比べる", text: "なぜコールしたのか、どのハンドにコールされる想定でベットしたのか、当時の理由を残します。さらに別のサイズやチェックの候補を挙げましょう。勝った選択が常に良く、負けた選択が常に悪いわけではありません。1回の結果だけでは期待値を確定できません。" },
   { title: "次に練習することを1つに絞る", text: "「すべてを直す」より、「リバーでベットする前に弱いコール候補を3つ挙げる」など、再現できる行動にします。ソルバーを使う際も条件が合っているかを確かめ、対戦が終わってから学習に使いましょう。解析条件やGTOの詳しい読み方はLv.4以降で扱います。" },
  ],
  takeaway: "事実・当時の予想・結果・次の練習を分ける。負けた理由を運だけ、勝った理由を実力だけにしない。",
  questions: [
   { id: "review-practice-1", topic: "結果と判断", situation: "相手のオールインにコールして負けました。判断時には勝率が必要勝率を上回ると考えていました。", question: "振り返りとして適切なのは？", choices: ["負けたのでコールは必ず間違い", "勝率の見積もりと前提を検証し、1回の結果と分ける", "負けたハンドはすべて記録しない"], answer: 1, explanation: "見積もりが正しかったかは検証が必要ですが、1回負けたという結果だけではコールの期待値は決まりません。" },
   { id: "review-practice-2", topic: "記録", situation: "ハンドが終わり、相手がAAを見せました。フロップの時点では相手の手札は見えていませんでした。", question: "履歴にはどう記録する？", choices: ["フロップ時点からAAと知っていたことにする", "相手の行動は省略する", "当時の想定レンジと、後で公開されたAAを分けて書く"], answer: 2, explanation: "当時の情報と後から判明した事実を分けると、結果に引っ張られずに判断を再現できます。" },
  ],
 },
];

export const LEVEL_THREE_PASS_SCORE = 10;
export const levelThreeExam: readonly PracticeQuestion[] = [
 { id: "exam-ranges-1", topic: "レンジ", situation: "相手が大きくベットしました。これまでの行動も記録されています。", question: "検討すべき候補は？", choices: ["ナッツだけ", "ブラフだけ", "履歴に合うバリューとブラフの両方"], answer: 2, explanation: "大きなサイズだけで手札を断定せず、行動の流れに合う両方の候補を考えます。" },
 { id: "exam-ranges-2", topic: "レンジ", situation: "相手はUTGから参加。フロップでコールし、ターンでも判断を続けます。", question: "相手の候補を考える方法は？", choices: ["プリフロップの候補から、ボードと各行動に合わせて見直す", "最初の候補を一切変えない", "すべての候補を1つに確定させる"], answer: 0, explanation: "新しい情報で候補とその重みを見直します。完全に確定できるとは限りません。" },
 { id: "exam-spr-1", topic: "SPR", situation: "フロップのベット前。2人の残りは6,000と4,000、ポットは2,000です。", question: "この時点のSPRは？", choices: ["3", "2", "5"], answer: 1, explanation: "残り有効スタック4,000÷ポット2,000＝2です。" },
 { id: "exam-spr-2", topic: "SPR", situation: "フロップのベット前、2人とも残り3,000、ポット1,000です。片方が500ベットし、もう片方が500コールしました。", question: "次のストリート開始時のSPRは？", choices: ["3", "2.5", "1.25"], answer: 2, explanation: "残りは両者2,500、ポットは2,000。2,500÷2,000＝1.25です。投入済みの500を残りスタックから引くことも必要です。" },
 { id: "exam-betting-1", topic: "ベット", situation: "フロップでフラッシュドローを持ち、相手を降ろす可能性と後の改善を狙ってベットします。", question: "この狙いは？", choices: ["セミブラフ", "必ずバリューベット", "常に誤り"], answer: 0, explanation: "フォールドさせる可能性と、コールされても改善する可能性を持つセミブラフです。利益的かは別途検討が必要です。" },
 { id: "exam-betting-2", topic: "サイズ", situation: "元のポット1,200に対し、相手が600ベット。あなたが600コールすれば最終ポットは2,400です。", question: "追加ベット・レーキを無視した必要勝率は？", choices: ["50%", "25%", "33.3%"], answer: 1, explanation: "600÷(1,200＋600＋600)＝25%です。" },
 { id: "exam-flop-1", topic: "フロップ", situation: "8♥ 8♣ 3♦のフロップです。", question: "ボードを見る際の正しい理解は？", choices: ["全員が必ずトリップス", "フラッシュが完成している", "ペアボードだが、相手の役はレンジと合わせて考える"], answer: 2, explanation: "共通カードに8のペアがありますが、誰もがトリップスとは限りません。8を持つ候補などをレンジから考えます。" },
 { id: "exam-flop-2", topic: "Cベット", situation: "同じAハイのフロップでも、2人のポットと4人のポットがあります。", question: "Cベット判断は？", choices: ["人数と参加レンジが違うため、同じ戦略とは限らない", "ボードが同じなら必ず同じ", "4人なら必ず全員フォールド"], answer: 0, explanation: "人数が増えると、考慮するレンジや反応が変わります。2人用の戦略をそのまま使えるとは限りません。" },
 { id: "exam-streets-1", topic: "ターン", situation: "フロップでベットした後、ターンで相手のドローが完成し得るカードが出ました。", question: "次にすべき検討は？", choices: ["前に打ったので必ずもう一度打つ", "自分と相手の候補の変化、ポットとスタックを確認", "すべての手札で必ずフォールド"], answer: 1, explanation: "追加カードによる変化を確認して計画を更新します。前のベットだけを理由に続ける必要はありません。" },
 { id: "exam-streets-2", topic: "リバー", situation: "フラッシュが完成しましたが、ボードにはペアもあります。", question: "勝敗を考えるときの注意点は？", choices: ["完成したので必ず勝ち", "フラッシュはワンペアに負ける", "相手の高いフラッシュやフルハウスなども検討する"], answer: 2, explanation: "役の完成と勝利は別です。自分のフラッシュより強い役が相手のレンジに残るか確認します。" },
 { id: "exam-review-1", topic: "レビュー", situation: "ハンドを検証したいのに、有効スタックやベット額が記録されていません。", question: "まず何をする？", choices: ["判断時の前提をできるだけ再現し、不明点を明記する", "勝敗だけで採点する", "別のサイズの解析を同じ条件とみなす"], answer: 0, explanation: "解析条件が違えば結論も変わり得ます。不明な情報を断定せず、再現できた条件を区別します。" },
 { id: "exam-review-2", topic: "レビュー", situation: "リバーで目的の曖昧なベットが何度も見つかりました。", question: "次の練習目標として具体的なのは？", choices: ["次は必ず全ハンド勝つ", "ベット前に、弱いコール候補か降ろしたい強い候補を挙げる", "負けた記録を消す"], answer: 1, explanation: "判断の前に実行できる具体的な手順を作ると、同じ課題を検証しやすくなります。勝敗そのものは保証できません。" },
];

export function scoreLevelThree(answers: readonly number[]): number {
 return levelThreeExam.reduce((score, question, index) => score + (answers[index] === question.answer ? 1 : 0), 0);
}

export const LEVEL_THREE_STORAGE_KEY = "poker-summit-academy-level3-v1";
export type LevelThreeProgress = { completed: string[]; bestScore: number | null };
export function parseLevelThreeProgress(raw: string | null): LevelThreeProgress {
 const empty: LevelThreeProgress = { completed: [], bestScore: null };
 if (!raw) return empty;
 try {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) return empty;
  const candidate = value as { completed?: unknown; bestScore?: unknown };
  const completed = Array.isArray(candidate.completed) ? [...new Set(candidate.completed.filter((id): id is string => typeof id === "string" && levelThreeLessons.some(lesson => lesson.id === id)))] : [];
  const bestScore = typeof candidate.bestScore === "number" && Number.isInteger(candidate.bestScore) && candidate.bestScore >= 0 && candidate.bestScore <= levelThreeExam.length ? candidate.bestScore : null;
  return { completed, bestScore };
 } catch { return empty; }
}

export function sprMetrics(own: number, opponent: number, pot: number) {
 if (![own, opponent, pot].every(Number.isFinite) || own < 0 || opponent < 0 || pot <= 0) return null;
 const effective = Math.min(own, opponent);
 return { effective, spr: effective / pot };
}
export function betMetrics(pot: number, fraction: number) {
 const bet = pot * fraction;
 return { bet, finalPot: pot + 2 * bet, requiredEquity: bet / (pot + 2 * bet) * 100 };
}
