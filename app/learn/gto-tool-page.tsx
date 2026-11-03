import Link from 'next/link';
import type {ReactNode} from 'react';
import {createClient} from '@/lib/supabase/server';
import {PortalHeader} from '@/app/portal-header';
import {PortalFooter} from '@/app/portal-footer';
import {BottomTabs} from '@/app/bottom-tabs';
import styles from './gto-tool-page.module.css';

/** Public GTO calculator pages (owner 2026/10/31: 計算機をログインなしで全部使えるように、説明文と会員登録の入口つき).
 * The tool runs in the visitor's browser; the explanation below it is plain text for readers and search. */
export async function GtoToolPage({title,lead,tool,children,join}:{title:string;lead:string;tool:ReactNode;children:ReactNode;
 /** Sign-up box wording for visitors (default: the calculator wording). */join?:{text:string;label:string}}){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 return <div className="portal"><PortalHeader userEmail={user?.email}/>
  <main className={styles.page}>
   <nav className={styles.breadcrumb} aria-label="パンくず"><Link href="/">TOP</Link> <span>›</span> <Link href="/learn">GTO・学習</Link> <span>›</span> {title}</nav>
   <h1 className={styles.title}>{title}</h1>
   <p className={styles.lead}>{lead}</p>
   <section className={styles.tool} aria-label={title}>{tool}</section>
   <div className={styles.join}>
    {user?<><p>マイページでは、GTOの表・フロップ戦略・GTOとの対戦など、ほかの練習道具も使えます。</p><Link href="/mypage/poker">マイページで練習する</Link></>
     :<><p>{join?.text??'計算結果を保存したり、GTOの表やGTOとの対戦で練習したりするには会員登録（無料）をしてください。'}</p><Link href="/signup">{join?.label??'計算結果を保存するには会員登録'}</Link></>}
   </div>
   <article className={styles.article}>{children}</article>
  </main>
  <PortalFooter/><BottomTabs active="home"/>
 </div>;
}
