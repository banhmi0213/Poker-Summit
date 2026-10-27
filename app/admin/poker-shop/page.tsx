import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
import {parseAdminShop,type AdminShopItem} from '@/lib/poker/shop';
import ShopPriceForm from './shop-price-form';
import styles from '../poker-rings/manager.module.css';
export const dynamic='force-dynamic';
export default async function Page(){
 const client=await createClient();const {data,error}=await client.rpc('poker_admin_shop_items');let items:AdminShopItem[]|null=null;try{if(!error)items=parseAdminShop(data);}catch{}
 return <main className={styles.page}><header className={styles.intro}><div><h1>チップ交換所</h1><p>会員がSummit chipで交換できるチケット（リング専用）の値段を設定します。</p></div><nav className={styles.links}><Link className="btn" href="/admin/poker-rings">リングゲーム卓設定</Link><Link className="btn" href="/mypage/chips">交換所を確認</Link></nav></header>
  <p className={styles.note}>値段が空欄の品は交換所に並びません。値段を変えても、すでに交換済みのチケットはそのまま使えます。</p>
  {!items?<p role="alert">読み込めませんでした。運営アカウントでログインしているか確認してください。</p>:items.map(item=><section className={styles.card} key={item.code}><h2>{item.label}</h2><p className={styles.note}>{item.description}</p><ShopPriceForm item={item}/></section>)}
 </main>;
}
