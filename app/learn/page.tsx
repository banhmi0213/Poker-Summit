import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { staticPageMetadata } from "@/lib/seo";
import { Academy } from "./academy";
import { LearnPlayerPage } from "./learn-hub";
import styles from "./learn.module.css";

export const metadata = staticPageMetadata({ title: "GTO・学習｜無料のプリフロップ表・ICM計算機・ポーカー学習コース", description: "無料・登録不要。プリフロップ表・毎日のGTOクイズ・ICM計算機・リバー計算機と、初心者から期待値・GTO・ソルバー読解まで段階的に学べるレッスン。", path: "/learn" });

export default async function LearnPage() {
 const supabase = await createClient();
 const { data: { user } } = await supabase.auth.getUser();
 return <div className="portal"><PortalHeader userEmail={user?.email} />
  <main className={styles.page}><nav className={styles.breadcrumb} aria-label="パンくず"><Link href="/">TOP</Link> <span>›</span> GTO・学習</nav><Academy /><LearnPlayerPage /></main>
  <PortalFooter /><BottomTabs active="home" />
 </div>;
}
