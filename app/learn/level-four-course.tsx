"use client";

import {useEffect,useState} from "react";
import {LessonQuiz} from "./lesson-quiz";
import {LevelFourDiagram} from "./level-four-diagrams";
import {expectedValues,LEVEL_FOUR_PASS_SCORE,LEVEL_FOUR_STORAGE_KEY,levelFourExam,levelFourLessons,mixedAction,outputExamples,parseLevelFourProgress,remainingCombos,type ComboHand,type LevelFourProgress} from "./level-four-content";
import styles from "./level-three.module.css";
import extra from "./level-four.module.css";

const fmt=(value:number)=>new Intl.NumberFormat("ja-JP",{maximumFractionDigits:2}).format(value);
const card=(value:string)=>value.replace(/s/g,"♠").replace(/h/g,"♥").replace(/d/g,"♦").replace(/c/g,"♣");

function EvExercise(){
 const [pot,setPot]=useState("1000"),[bet,setBet]=useState("500"),[equity,setEquity]=useState("35"),[folds,setFolds]=useState("40");
 const strings=[pot,bet,equity,folds];
 const valid=strings.every(s=>s.trim()!==""&&/^\d+(\.\d+)?$/.test(s)&&Number(s)<=10000000);
 const result=valid?expectedValues(Number(pot),Number(bet),Number(equity),Number(folds)):null;
 return <section className={styles.exercise} aria-label="期待値計算演習"><h4>同じ金額で、2つの仮定を比較する</h4><p>リバーの計算です。コール側とベット側の別々の仮定を比べます。同じハンドの最適行動を解くものではありません。</p>
  <div className={`${styles.fields} ${extra.twoColumns}`}>{[{id:"l4-pot",label:"相手のベット前のポット",value:pot,set:setPot},{id:"l4-bet",label:"ベット・コール額",value:bet,set:setBet},{id:"l4-equity",label:"コール時の勝率（%）",value:equity,set:setEquity},{id:"l4-folds",label:"相手のフォールド率（%）",value:folds,set:setFolds}].map(f=><label key={f.id} htmlFor={f.id}>{f.label}<input id={f.id} type="text" inputMode="decimal" maxLength={12} value={f.value} onChange={e=>f.set(e.target.value)}/></label>)}</div>
  <div className={styles.calculation} aria-live="polite">{result?<><strong>コールEV：{result.callEv>=0?"＋":""}{fmt(result.callEv)} チップ</strong><p>勝率{equity}% ×（{pot}＋{bet}）− 負ける確率 × {bet}</p><p>必要勝率：{fmt(result.requiredEquity)}% ／ フォールドEV：0</p><hr/><strong>純粋なブラフEV：{result.bluffEv>=0?"＋":""}{fmt(result.bluffEv)} チップ</strong><p>相手が降りる確率{folds}% × {pot} − コールされる確率 × {bet}</p><p>必要なフォールド率：{fmt(result.requiredFolds)}%</p></>:<p>金額は0より大きく1,000万以下、確率は0〜100の数値を入力してください。</p>}</div>
  <p className={styles.note}>引き分け・レーキ・追加アクションはありません。ブラフはコールされたら必ず負け、相手の応答はフォールドかコールのみと仮定します。実際の勝率・フォールド率の推定は行いません。</p>
 </section>;
}

function ComboExercise(){
 const [hand,setHand]=useState<ComboHand>("AA"),[removed,setRemoved]=useState(0);
 const dead=removed===0?[]:removed===1?["As"]:["As","Kd"];
 const combos=remainingCombos(hand,dead);
 return <section className={styles.exercise} aria-label="コンボ計算演習"><h4>見えているカードを除いて数える</h4><p>除去なし・A♠のみ・A♠ K♦の順で影響を見ます。相手の行動頻度を掛ける前の、物理的な組み合わせの数です。</p>
  <div className={styles.optionRow} aria-label="数えるハンド">{(["AA","AKs","AKo"] as const).map(value=><button key={value} type="button" aria-pressed={hand===value} onClick={()=>setHand(value)}>{value}</button>)}</div>
  <div className={styles.optionRow} aria-label="除くカード">{["除去なし","A♠を除く","A♠ K♦を除く"].map((label,i)=><button key={label} type="button" aria-pressed={removed===i} onClick={()=>setRemoved(i)}>{label}</button>)}</div>
  <div className={styles.calculation} aria-live="polite"><strong>{hand}：{combos.length} コンボ</strong><div className={extra.comboList}>{combos.map(c=><span key={c.join("")}>{c.map(card).join(" ")}</span>)}</div></div>
  <p className={styles.note}>段階的な枚数確認用の演習です。特定の参加レンジや、相手がそのハンドを持つ確率を表すものではありません。</p>
 </section>;
}

function MixedExercise(){
 const [frequency,setFrequency]=useState(40),[draw,setDraw]=useState(39);
 return <section className={styles.exercise} aria-label="混合戦略の演習"><h4>頻度を0〜99に割り当てる</h4><p>ここでの比率は教材用の仮定です。あなたの実戦の手札に対するGTO解ではありません。</p><div className={styles.optionRow}>{[20,40,80].map(value=><button key={value} type="button" aria-pressed={frequency===value} onClick={()=>setFrequency(value)}>ベット{value}%</button>)}</div>
  <div className={extra.frequencyBar} aria-label={`ベット${frequency}%・チェック${100-frequency}%`}><span style={{width:frequency+"%"}}/><span style={{width:(100-frequency)+"%"}}/></div>
  <p>0〜{frequency-1}：ベット ／ {frequency}〜99：チェック</p><label className={extra.slider} htmlFor="l4-draw">乱数（0〜99）：{draw}<input id="l4-draw" type="range" min={0} max={99} step={1} value={draw} onChange={e=>setDraw(Number(e.target.value))}/></label>
  <button type="button" onClick={()=>setDraw(Math.floor(Math.random()*100))}>乱数を1回引く</button><div className={styles.calculation} aria-live="polite"><strong>乱数{draw}の割り当て：{mixedAction(draw,frequency)==="bet"?"ベット":"チェック"}</strong><p>ベット頻度{frequency}%は、勝率{frequency}%を意味しません。短期間の結果が指定頻度に一致する保証もありません。</p></div>
 </section>;
}

const rangeCases=[
 {name:"Aハイの例",board:"A♠ 7♦ 2♣",a:"AA・KK・QQ・AK・AQ",b:"77・22・A7s・87s・76s",note:"この限定例ではA側に最上位のAA、B側にも77・22のセットやA7sのツーペアがあります。強い役を1つ見つけただけでは、レンジ全体の平均エクイティまでは分かりません。"},
 {name:"低くつながる例",board:"9♠ 8♦ 7♣",a:"AA・KK・QQ・JJ・TT・AK・AQ",b:"JTs・T6s・99・88・77・98s・87s・76s",note:"この限定例ではB側のJTsやT6sにストレートがあり、A側の候補にはありません。A側にオーバーペアが多くても、最上位の役は別に確認する必要があります。"},
];
function AdvantageExercise(){
 const [index,setIndex]=useState(0);const current=rangeCases[index];
 return <section className={styles.exercise} aria-label="レンジ優位比較"><h4>両側の強い候補を見比べる</h4><p>下の候補だけを持つと仮定した教材です。実際のオープン・コールレンジではなく、コンボの重みや平均エクイティは計算していません。</p><div className={styles.optionRow}>{rangeCases.map((item,i)=><button key={item.name} type="button" aria-pressed={index===i} onClick={()=>setIndex(i)}>{item.name}</button>)}</div><div className={styles.calculation}><strong>ボード：{current.board}</strong><p>A側の候補：{current.a}</p><p>B側の候補：{current.b}</p></div><p aria-live="polite">{current.note}</p><p className={styles.note}>この候補の列挙だけから、ベット頻度・サイズや全体の優劣を断定しません。</p></section>;
}

function SolverExercise(){
 const [index,setIndex]=useState(0),[selected,setSelected]=useState(0);const example=outputExamples[index];const row=example.rows[selected];const difference=Math.max(...example.rows.map(r=>r.ev))-row.ev;
 return <section className={styles.exercise} aria-label="ソルバー出力読解"><h4>頻度・サイズ・EVの列を読み分ける</h4><p className={extra.exampleNotice}><strong>教材用の架空出力です。実際のソルバー計算やGTO推奨値ではありません。</strong></p><p>同じ単位（BB）・同じ判断時点の出力を比べる練習です。実戦で使う前には、人数・スタック・ボード・レンジ・レーキなどが一致するかを別に確認します。</p><div className={styles.optionRow}>{outputExamples.map((item,i)=><button key={item.id} type="button" aria-pressed={index===i} onClick={()=>{setIndex(i);setSelected(0);}}>{item.label}</button>)}</div>
  <table className={extra.outputTable}><caption>架空のアクション別出力</caption><thead><tr><th scope="col">行動・サイズ</th><th scope="col">頻度</th><th scope="col">EV</th></tr></thead><tbody>{example.rows.map((item,i)=><tr key={item.action}><th scope="row"><button type="button" aria-pressed={selected===i} onClick={()=>setSelected(i)}>{item.action}</button></th><td>{item.frequency}%</td><td>{fmt(item.ev)} BB</td></tr>)}</tbody></table>
  <div className={styles.calculation} aria-live="polite"><strong>{row.action}：頻度{row.frequency}% ／ EV {fmt(row.ev)} BB</strong><p>この表の最大EVとの差：{fmt(difference)} BB</p><p>{example.note}</p></div><p className={styles.note}>ここで示すEV差は、元の条件・相手戦略を固定した表内の差です。戦略全体の頻度を変更した後の損失を保証するものではありません。</p>
 </section>;
}

function ApplicationExercise(){
 const [checks,setChecks]=useState([false,false,false]);
 const labels=["ポジション・スタック・人数・ポット形式をそろえた","頻度・サイズ・EVと、その基準を分けて説明した","次の復習で確かめたい判断を1つ選んだ"];
 return <section className={styles.exercise} aria-label="戦略復習チェック"><h4>次の復習の手順を作る</h4><p>自分の履歴、またはここまでの例題を使って確認してください。このチェック内容は保存しません。</p><div className={styles.checklist}>{labels.map((label,i)=><label key={label}><input type="checkbox" checked={checks[i]} onChange={e=>setChecks(previous=>previous.map((v,j)=>j===i?e.target.checked:v))}/>{label}</label>)}</div><p role="status">{checks.filter(Boolean).length} / 3 項目を確認{checks.every(Boolean)?"。対戦後の復習に使う準備ができました。":"。結果だけでなく、判断の前提をそろえましょう。"}</p></section>;
}

export function LevelFourCourse(){
 const [selected,setSelected]=useState("ev"),[progress,setProgress]=useState<LevelFourProgress>({completed:[],bestScore:null});
 const [loaded,setLoaded]=useState(false),[storageAvailable,setStorageAvailable]=useState(true),[practiceDone,setPracticeDone]=useState(false);
 useEffect(()=>{try{setProgress(parseLevelFourProgress(localStorage.getItem(LEVEL_FOUR_STORAGE_KEY)));}catch{setStorageAvailable(false);}setLoaded(true);},[]);
 function persist(next:LevelFourProgress){setProgress(next);try{localStorage.setItem(LEVEL_FOUR_STORAGE_KEY,JSON.stringify(next));}catch{setStorageAvailable(false);}}
 function goTo(id:string){setSelected(id);setPracticeDone(false);requestAnimationFrame(()=>{const h=document.getElementById("level-four-current-title");h?.focus({preventScroll:true});h?.scrollIntoView({behavior:"auto",block:"start"});});}
 const lesson=levelFourLessons.find(l=>l.id===selected),index=levelFourLessons.findIndex(l=>l.id===selected),complete=lesson?progress.completed.includes(lesson.id):false;
 return <section id="level-four-course" className={styles.course} aria-labelledby="level-four-title">
  <header className={styles.header}><span>LEVEL 4 · STRATEGY MASTER</span><h2 id="level-four-title">戦略マスター</h2><p>6レッスンで期待値・GTO・ソルバー出力の読み方を学び、12問の戦略・確率テストに挑戦します。Lv.3相当の実戦判断を理解した方におすすめです。</p><p className={styles.note}>計算演習と出力読解のための教材です。実戦の最適戦略を計算するソルバーや、対戦中の支援機能ではありません。</p></header>
  <div className={styles.progress} aria-label="Lv.4学習進捗"><div><strong>{loaded?`${progress.completed.length} / 6 レッスン学習済み`:"学習状況を読み込み中"}</strong><p>テスト最高得点：{loaded&&progress.bestScore!==null?`${progress.bestScore} / 12`:"未記録"}{loaded&&progress.bestScore!==null&&progress.bestScore>=LEVEL_FOUR_PASS_SCORE?"（合格）":""}</p></div><progress max={6} value={progress.completed.length} aria-label="Lv.4の学習済みレッスン数"/></div>
  <p className={styles.note} role="status">{storageAvailable?"Lv.4の学習済みと最高得点を、このブラウザに保存します。Lv.3の記録や会員レベル・公式バッジは変更されません。":"ブラウザへの保存が利用できません。この画面では学習できますが、再読み込み後に記録が残らない場合があります。"}</p>
  <div className={styles.layout}><nav className={styles.navigation} aria-label="Lv.4のレッスンを選ぶ">{levelFourLessons.map((item,i)=><button type="button" key={item.id} aria-current={selected===item.id?"step":undefined} onClick={()=>goTo(item.id)}><span>{String(i+1).padStart(2,"0")}</span><strong>{item.title}</strong>{progress.completed.includes(item.id)&&<small>学習済み</small>}</button>)}<button type="button" aria-current={selected==="exam"?"step":undefined} onClick={()=>goTo("exam")}><span>07</span><strong>戦略・確率テスト</strong></button></nav>
   <div className={styles.main}><h3 id="level-four-current-title" tabIndex={-1}>{lesson?`${String(index+1).padStart(2,"0")} ${lesson.title}`:"07 戦略・確率テスト"}</h3>
    {lesson?<><p className={styles.subtitle}>{lesson.subtitle}</p><p className={styles.goal}><strong>このレッスンの目標</strong>{lesson.goal}</p><LevelFourDiagram lessonId={lesson.id}/>{lesson.sections.map(item=><section key={item.title} className={styles.explanation}><h4>{item.title}</h4><p>{item.text}</p></section>)}<p className={styles.takeaway}><strong>覚えておきたいこと</strong>{lesson.takeaway}</p>
     {lesson.id==="ev"&&<EvExercise/>}{lesson.id==="combos"&&<ComboExercise/>}{lesson.id==="mixing"&&<MixedExercise/>}{lesson.id==="advantage"&&<AdvantageExercise/>}{lesson.id==="solver"&&<SolverExercise/>}{lesson.id==="application"&&<ApplicationExercise/>}
     <LessonQuiz key={lesson.id} level={4} questions={lesson.questions} onFinish={()=>setPracticeDone(true)}/><div className={styles.footer}><button type="button" disabled={!loaded||(!complete&&!practiceDone)} aria-pressed={complete} onClick={()=>{if(!loaded||(!complete&&!practiceDone))return;persist({...progress,completed:complete?progress.completed.filter(id=>id!==lesson.id):[...progress.completed,lesson.id]});}}>{complete?"学習済みを解除する":"解説を確認して学習済みにする"}</button><button type="button" onClick={()=>goTo(index<levelFourLessons.length-1?levelFourLessons[index+1].id:"exam")}>{index<levelFourLessons.length-1?"次のレッスンへ":"戦略・確率テストへ"}</button></div>{!complete&&!practiceDone&&<p className={styles.note}>2問に回答し、解説の後で「結果を見る」を押すと、学習済みにできます。</p>}
    </>:<><p>全6レッスンから12問。{LEVEL_FOUR_PASS_SCORE}問以上で合格です。学習済みチェックとは別に採点し、何度でも受け直せます。</p>{loaded?<LessonQuiz key="level4-exam" level={4} exam examTitle="戦略・確率テスト" passScore={LEVEL_FOUR_PASS_SCORE} questions={levelFourExam} onFinish={score=>persist({...progress,bestScore:Math.max(progress.bestScore??0,score)})}/>:<p>学習記録を読み込んでいます。</p>}</>}
   </div>
  </div>
  <details className={styles.sources}><summary>学習内容の参考資料</summary><p>本コースの文章・例題はPoker Summit独自の教材です。用語や出力の読み方は、以下の資料も参考にできます（英語）。架空の出力例は各社の解析データを転載したものではありません。</p><ul><li><a href="https://blog.gtowizard.com/understanding-nash-distance/" target="_blank" rel="noopener noreferrer">GTO Wizard：Understanding Nash Distance</a></li><li><a href="https://help.gtowizard.com/study-mode/" target="_blank" rel="noopener noreferrer">GTO Wizard：Study Mode</a></li><li><a href="https://blog.gtowizard.com/understanding-blockers-in-poker/" target="_blank" rel="noopener noreferrer">GTO Wizard：Understanding Blockers in Poker</a></li></ul></details>
 </section>;
}
