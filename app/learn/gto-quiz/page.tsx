import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
import {PortalHeader} from '@/app/portal-header';
import {PortalFooter} from '@/app/portal-footer';
import {BottomTabs} from '@/app/bottom-tabs';
import {staticPageMetadata,SITE_URL} from '@/lib/seo';
import {dailyQuestions,todayJst} from '@/lib/poker/daily-quiz';
import {DailyQuiz} from './daily-quiz';
import styles from '../gto-tool-page.module.css';

// One page whose questions change every day (Japan time); past days are listed on /learn/gto-quiz/archive.
// noindex until the search side switches it on (owner 2026/10/31).
export const dynamic='force-dynamic';
export const metadata=staticPageMetadata({title:'今日のGTOクイズ｜毎日5問・ポーカーの正解の打ち方を無料で練習',
 description:'ポーカーのGTO（正解の打ち方）クイズを毎日5問出題。プリフロップ3問・フロップ2問。ログイン不要・無料で、答えるとGTOがその手で選ぶ割合と解説が出ます。結果はXでシェアできます。',
 path:'/learn/gto-quiz',index:false});

export default async function Page(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 const date=todayJst(),questions=dailyQuestions(date);
 const [y,m,d]=date.split('-').map(Number);
 return <div className="portal"><PortalHeader userEmail={user?.email}/>
  <main className={styles.page}>
   <nav className={styles.breadcrumb} aria-label="パンくず"><Link href="/">TOP</Link> <span>›</span> <Link href="/learn">GTO・学習</Link> <span>›</span> 今日のGTOクイズ</nav>
   <h1 className={styles.title}>今日のGTOクイズ（{m}月{d}日）</h1>
   <p className={styles.lead}>毎日5問。選ぶとGTOと比べて採点し、解説が出ます。</p>
   {questions?<DailyQuiz date={date} questions={questions} member={Boolean(user)} url={`${SITE_URL}/learn/gto-quiz`}/>:<p>今日の問題を準備中です。</p>}
   <article className={styles.article} style={{marginTop:24}}>
    <h2>採点のしかた</h2>
    <p>GTOは、同じ手でも打ち方を混ぜることがあります。たとえば「ベット60%・チェック40%」のような手です。そこで、選んだ打ち方がGTOでその手のいちばん多い打ち方に近いほど高い点にしています。いちばん多い打ち方の8割以上の割合なら「正解」、3割以上なら「まずまず」、それより少なければ「ミス」です。</p>
    <h2>出題する場面</h2>
    <ul>
     <li>プリフロップ3問：オープンするか、オープンされたとき、3ベットされたとき</li>
     <li>フロップ2問：シングルレイズ・3ベットポットなどの2人の場面から</li>
    </ul>
    <p>答えはPokerSummitが計算したGTOの表とフロップの計算結果から出しています。</p>
    <h2>過去の問題</h2>
    <p>これまでの問題は、答えと解説付きで<Link href="/learn/gto-quiz/archive">過去のGTOクイズ</Link>にまとめています。</p>
   </article>
  </main>
  <PortalFooter/><BottomTabs active="home"/>
 </div>;
}
