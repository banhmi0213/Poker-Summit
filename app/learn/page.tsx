import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { staticPageMetadata } from "@/lib/seo";
import { Academy } from "./academy";
import styles from "./learn.module.css";

export const metadata = staticPageMetadata({ title: "Poker Summit Academy｜初心者から実戦判断まで学ぶポーカー学習コース", description: "無料・登録不要。初心者から実戦判断、Lv.4の期待値・GTO・ソルバー読解まで、解説・操作演習・確認テストで段階的に学べます。", path: "/learn" });

export default async function LearnPage() {
 const supabase = await createClient();
 const { data: { user } } = await supabase.auth.getUser();
 return <div className="portal"><PortalHeader userEmail={user?.email} />
  <main className={styles.page}><nav className={styles.breadcrumb} aria-label="パンくず"><Link href="/">TOP</Link> <span>›</span> 学習コース</nav><Academy /></main>
  <PortalFooter /><BottomTabs active="home" />
 </div>;
}
