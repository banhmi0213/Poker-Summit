import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { joinEvent, leaveEvent } from "@/app/member-actions";
import { setFavoriteEvent } from "./actions";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { StoreNamePlaceholder } from "@/app/store-name-placeholder";
import styles from "./detail.module.css";

function date(value: string | null, time = false) {
  if (!value) return "未定";
  return new Intl.DateTimeFormat("ja-JP", time ? { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" } : { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).format(new Date(value));
}
export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: event, error } = await supabase.from("events").select("id,title,location,description,start_at,end_at,category,store_id,banner_image_url,stores(id,name,pref,city,address,nearest_station,banner_url,logo_url,status)").eq("id",params.id).eq("status","published").maybeSingle();
  if (error) throw new Error("イベント情報を読み込めませんでした。");
  if (!event) notFound();
  const e = event as any;
  const store = e.stores?.status === "approved" ? e.stores : null;
  const path = `/events/${e.id}`;
  const isPast = Boolean((e.end_at || e.start_at) && new Date(e.end_at || e.start_at).getTime() < Date.now());
  let joined = false, saved = false;
  if (user) {
    const [p,f] = await Promise.all([
      supabase.from("event_participants").select("event_id").eq("user_id",user.id).eq("event_id",e.id).maybeSingle(),
      supabase.from("favorite_events").select("event_id").eq("user_id",user.id).eq("event_id",e.id).maybeSingle()
    ]);
    if (p.error || f.error) throw new Error("参加・お気に入り情報を読み込めませんでした。");
    joined = Boolean(p.data); saved = Boolean(f.data);
  }
  const { data: otherEvents, error: otherError } = e.store_id ? await supabase.from("events").select("id,title,start_at,category,banner_image_url").eq("store_id",e.store_id).eq("status","published").neq("id",e.id).gte("start_at",new Date().toISOString()).order("start_at").limit(3) : { data: [], error: null };
  if (otherError) throw new Error("関連イベントを読み込めませんでした。");
  const location = e.location || [store?.pref,store?.city].filter(Boolean).join(" ") || "未定";
  const mapQuery = [e.location,store?.address,store?.name].filter(Boolean).join(" ");
  return <div>
    <PortalHeader userEmail={user?.email}/>
    <main className={`container ${styles.page}`}>
      <Link href="/events" className="breadcrumb">← トーナメント・イベント一覧に戻る</Link>
          <div className={styles.heading}><h1>{e.title}</h1>{e.category && <span>{e.category}</span>}{isPast && <span>終了</span>}</div>
      <div className={styles.layout}>
        <article className={styles.content}>
          <div className={styles.facts} style={{ marginTop: 0 }}>
            {[['▦','開催日',date(e.start_at)],['◷','開始時間',date(e.start_at,true)],['♙','開催店舗',store?.name || '未登録'],['⌖','開催場所',location]].map(([icon,label,value]) => <div key={label}><b aria-hidden="true">{icon}</b><span>{label}<strong>{value}</strong></span></div>)}
          </div>
          <nav className={styles.sections} aria-label="イベント詳細の項目"><a href="#overview">大会概要</a><a href="#structure">ストラクチャー</a><a href="#access">会場・アクセス</a></nav>
          <section id="overview" className={styles.section}><h2>大会概要</h2>
            {e.banner_image_url && <img className={styles.banner} src={e.banner_image_url} alt={e.title}/>}
            <p className={styles.description}>{e.description || "大会の詳細は主催店舗へお問い合わせください。"}</p>
            <dl className={styles.details}><div><dt>イベント種別</dt><dd>{e.category || "未登録"}</dd></div><div><dt>開始日時</dt><dd>{date(e.start_at)} {date(e.start_at,true)}</dd></div>{e.end_at && <div><dt>終了予定</dt><dd>{date(e.end_at)} {date(e.end_at,true)}</dd></div>}<div><dt>主催店舗</dt><dd>{store?.name || "未登録"}</dd></div></dl>
          </section>
          <section id="structure" className={styles.section}><h2>ストラクチャー</h2><div className={styles.notice}>ブラインド・スタートスタック・レイトレジストなどの情報は、大会概要または主催店舗の案内をご確認ください。</div></section>
          <section id="access" className={styles.section}><h2>⌖ 会場・アクセス</h2><div className={styles.access}><div><strong>{store?.name || location}</strong><p>{store?.address || location}</p>{store?.nearest_station && <p>最寄駅：{store.nearest_station}</p>}</div>{mapQuery && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`} target="_blank" rel="noopener noreferrer" className={styles.outline}>⌖ 地図・経路を見る ↗</a>}</div></section>
        </article>
        <aside className={styles.sidebar}>
          <section className={styles.panel}><h2>♟ 参加情報</h2><dl className={styles.participation}><div><dt>参加費</dt><dd>主催店舗にご確認ください</dd></div><div><dt>開始日時</dt><dd>{date(e.start_at)} {date(e.start_at,true)}</dd></div></dl>
            {isPast ? <p className={styles.notice}>このイベントは終了しました。{joined && "参加予定に登録していました。"}</p> : user ? <form action={async()=>{"use server"; if(joined) await leaveEvent(e.id,path); else await joinEvent(e.id,path);}}><button className={styles.primary} type="submit">{joined ? "✓ 参加予定を取消" : "▦ 参加予定に追加"}</button></form> : <Link className={styles.primary} href={`/login?next=${encodeURIComponent(path)}`}>▦ ログインして参加予定に追加</Link>}
            {user ? <form action={async()=>{"use server"; await setFavoriteEvent(e.id,!saved);}}><button className={styles.outline} type="submit" aria-pressed={saved}>{saved ? "★ お気に入り登録済み" : "☆ お気に入り"}</button></form> : <Link className={styles.outline} href={`/login?next=${encodeURIComponent(path)}`}>☆ お気に入り</Link>}
            <p className={styles.help}>※ 参加予定の登録は予約確定ではありません。</p>
          </section>
          {store && <section className={styles.panel}><h2>♙ 主催店舗</h2><h3>{store.name}</h3><Link href={`/stores/${store.id}`} className={styles.storeCover}>{store.banner_url || store.logo_url ? <img src={store.banner_url || store.logo_url} alt={store.name}/> : <StoreNamePlaceholder name={store.name}/>}</Link><Link className={styles.outline} href={`/stores/${store.id}`}>店舗ページを見る ›</Link></section>}
          {!!otherEvents?.length && <section className={styles.related}><header><h2>この店舗のその他のイベント</h2><Link href="/events">すべて見る ›</Link></header>{otherEvents.map((ev:any)=><Link className={styles.relatedItem} key={ev.id} href={`/events/${ev.id}`}>{ev.banner_image_url ? <img src={ev.banner_image_url} alt=""/> : <div className={styles.eventFallback}>POKER<br/>SUMMIT</div>}<div><small>{date(ev.start_at)} {date(ev.start_at,true)} {ev.category}</small><strong>{ev.title}</strong><span>{store?.name}</span></div></Link>)}</section>}
        </aside>
      </div>
    </main><PortalFooter/><BottomTabs/>
  </div>;
}
