import Link from "next/link";
import { redirect } from "next/navigation";
import { getPokerNews } from "@/lib/poker-news";
import { NEWS_CATEGORIES,newsSearchText,validNewsDate } from "@/lib/poker-news-input";
import { staticPageMetadata } from "@/lib/seo";
import { PortalHeader } from "../portal-header";
import { PortalFooter } from "../portal-footer";
import { PokerNewsList } from "./news-list";
import styles from "../home-poker-news.module.css";
export const dynamic="force-dynamic";
export const metadata=staticPageMetadata({title:"ポーカーニュース一覧",description:"国内外のポーカー大会・結果・業界情報の見出しと概要を掲載。日付・カテゴリ・キーワードで検索できます。",path:"/poker-news"});
export default async function PokerNewsPage({searchParams}:{searchParams:{page?:string;date?:string;category?:string;q?:string}}){
 const q=newsSearchText(String(searchParams.q||""));const date=validNewsDate(String(searchParams.date||""))?searchParams.date!:"";const category=NEWS_CATEGORIES.some(x=>x===searchParams.category)?searchParams.category!:"";const page=Math.max(1,Math.min(10000,Number.parseInt(String(searchParams.page||"1"),10)||1));
 const result=await getPokerNews({page,date,category,q}).catch(()=>null);const pages=Math.max(1,Math.ceil((result?.count||0)/10));
 function href(p:number){const params=new URLSearchParams();if(q)params.set("q",q);if(date)params.set("date",date);if(category)params.set("category",category);params.set("page",String(p));return `/poker-news?${params}`;}
 if(result&&page>pages)redirect(href(pages));
 return <><PortalHeader/><main className="container" style={{paddingTop:28,paddingBottom:40}}><nav aria-label="パンくず"><Link href="/">TOP</Link> / ポーカーニュース</nav><section className={styles.section}><header className={styles.header}><span>POKER SUMMIT NEWS</span><h1>📰 ポーカーニュース一覧</h1><p>国内外の大会・選手の活躍・業界情報を、新しい日付から掲載しています。</p></header><form action="/poker-news" className={styles.filters}><label>日付（掲載日・収集日）<input type="date" name="date" defaultValue={date}/></label><label>カテゴリ<select name="category" defaultValue={category}><option value="">すべて</option>{NEWS_CATEGORIES.map(x=><option key={x}>{x}</option>)}</select></label><label>フリーワード<input type="search" name="q" defaultValue={q} maxLength={100} placeholder="大会名・選手名など"/></label><button className="btn primary">検索する</button><Link href="/poker-news">条件をクリア</Link></form>{!result?<p role="alert">ニュースの取得に失敗しました。時間をおいて再度ご確認ください。</p>:<><p>全{result.count}件{result.count>0&&`（${(page-1)*10+1}〜${Math.min(page*10,result.count)}件）`}</p>{result.entries.length?<PokerNewsList entries={result.entries}/>:<p>条件に一致するニュースがありません。</p>}<nav className={styles.pagination} aria-label="ニュースのページ切り替え">{page>1&&<Link href={href(page-1)}>前へ</Link>}<span>{page} / {pages}</span>{page<pages&&<Link href={href(page+1)}>次へ</Link>}</nav></>}</section></main><PortalFooter/></>;
}
