import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
import {PortalHeader} from '@/app/portal-header';
import {PortalFooter} from '@/app/portal-footer';
import {BottomTabs} from '@/app/bottom-tabs';
import {staticPageMetadata} from '@/lib/seo';
import {dailyQuestions,pastDays,todayJst} from '@/lib/poker/daily-quiz';
import {explainQuiz,gradeQuiz} from '@/lib/poker/gto-quiz';
import {quizCardRed,quizCardText} from '@/lib/poker/quiz-text';
import styles from '../../gto-tool-page.module.css';
import quiz from '../daily-quiz.module.css';

// Past daily questions with answers and explanations, one list (no page per day). noindex until the search side
// switches it on (owner 2026/10/31).
export const dynamic='force-dynamic';
export const metadata=staticPageMetadata({title:'過去のGTOクイズ｜答えと解説付きの問題一覧',
 description:'毎日出題しているポーカーのGTOクイズの過去問です。プリフロップとフロップの場面ごとに、GTOの正解の打ち方とその割合、解説を載せています。',
 path:'/learn/gto-quiz/archive',index:false});
const PER_PAGE=7;
const pct=(f:number)=>`${Math.round(f*100)}%`;

export default async function Page({searchParams}:{searchParams?:{page?:string}}){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 const days=pastDays(todayJst()),pages=Math.max(1,Math.ceil(days.length/PER_PAGE));
 const page=Math.min(pages,Math.max(1,Number(searchParams?.page)||1)),shown=days.slice((page-1)*PER_PAGE,page*PER_PAGE);
 return <div className="portal"><PortalHeader userEmail={user?.email}/>
  <main className={styles.page}>
   <nav className={styles.breadcrumb} aria-label="パンくず"><Link href="/">TOP</Link> <span>›</span> <Link href="/learn">学習コース</Link> <span>›</span> <Link href="/learn/gto-quiz">今日のGTOクイズ</Link> <span>›</span> 過去の問題</nav>
   <h1 className={styles.title}>過去のGTOクイズ（答えと解説付き）</h1>
   <p className={styles.lead}>これまでに出題した「今日のGTOクイズ」の問題です。6人卓・100BBのキャッシュゲームの場面で、GTO（相手にどう打たれても大きく損をしない打ち方）がその手でそれぞれの打ち方を選ぶ割合と、その理由を載せています。今日の問題は<Link href="/learn/gto-quiz">今日のGTOクイズ</Link>で解けます。</p>
   {!shown.length&&<p>過去の問題はまだありません。</p>}
   {shown.map(date=>{const [,m,d]=date.split('-').map(Number),qs=dailyQuestions(date)??[];
    return <article key={date} className={styles.article} style={{marginBottom:18}}>
     <h2>{m}月{d}日の問題</h2>
     {qs.map((q,i)=>{const best=q.freqs.indexOf(Math.max(...q.freqs)),lines=explainQuiz(q,gradeQuiz(q,best));
      return <section key={i}>
       <h3>{i+1}問目　{q.title}：{q.hero} {q.handClass}</h3>
       <p className={quiz.hand} style={{color:'inherit'}}>{q.board.length>0&&<>ボード {q.board.map(c=><b key={c} className={quiz.card} data-red={quizCardRed(c)||undefined}>{quizCardText(c)}</b>)}　</>}あなた（{q.hero}） {q.cards.map(c=><b key={c} className={quiz.card} data-red={quizCardRed(c)||undefined}>{quizCardText(c)}</b>)}</p>
       <p>{q.scene}あなたの番です。選択肢：{q.options.join('・')}</p>
       <p><b>GTOの答え：</b>{q.options.map((o,k)=>[o,q.freqs[k]] as const).filter(([,f])=>f>=0.005).sort((a,b)=>b[1]-a[1]).map(([o,f])=>`${o} ${pct(f)}`).join('・')}</p>
       <ul>{lines.slice(1).map((l,k)=><li key={k}>{l}</li>)}</ul>
      </section>;})}
    </article>;})}
   {pages>1&&<nav aria-label="ページ" style={{display:'flex',gap:12,justifyContent:'center',margin:'16px 0'}}>
    {page>1&&<Link href={`/learn/gto-quiz/archive?page=${page-1}`}>新しい問題</Link>}<span>{page} / {pages}</span>{page<pages&&<Link href={`/learn/gto-quiz/archive?page=${page+1}`}>前の問題</Link>}
   </nav>}
  </main>
  <PortalFooter/><BottomTabs active="home"/>
 </div>;
}
