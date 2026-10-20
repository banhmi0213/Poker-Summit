import {DealerReviews} from "./reviews";
import {NotificationBadge} from "@/app/matching/chat/notification-badge";
import { dealerReliability } from "@/lib/dealer-reliability";
import { DealerReliabilityView } from "@/app/account/dealer/reliability";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { classifyDevice, isBotUserAgent } from "@/lib/device";
import { visitSource } from "@/lib/visit-source";
import { recordAdAttribution } from "@/lib/ad-attribution";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { DealerDetail } from "./detail";
import styles from "./dealer.module.css";
export const dynamic="force-dynamic";
export default async function MyDealerPage({searchParams}:{searchParams:{done?:string;reviews?:string;utm_source?:string;utm_campaign?:string}}){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 // ディーラー登録広告の受け口(2026/10/21)。広告の目印付きで来た人・未ログインで来た人を数え、
 // 未ログインなら会員登録へ(登録が終わったらここへ戻る)。登録済みでディーラー未登録なら登録画面へ。
 const source=visitSource(searchParams.utm_source,searchParams.utm_campaign);
 if(!user||source){
  const isAdmin=user?(await supabase.rpc("is_admin")).data===true:false;
  const hdrs=await headers();
  const ua=hdrs.get("user-agent");
  if(!isAdmin&&!isBotUserAgent(ua)){
   await createServiceRoleClient().from("page_views").insert({path:"/account/dealer",referrer:hdrs.get("referer")??null,device:classifyDevice(ua),source}).then(()=>{},()=>{});
  }
  if(user&&!isAdmin)await recordAdAttribution(user.id,source,"visit");
 }
 if(!user)redirect(`/signup?next=/account/dealer${source?`&src=${encodeURIComponent(source)}`:""}`);
 const [profile,address]=await Promise.all([supabase.from("dealer_profiles").select("*").eq("user_id",user.id).maybeSingle(),supabase.from("dealer_addresses").select("address").eq("user_id",user.id).maybeSingle()]);
 if(profile.error||address.error)throw new Error("登録情報を読み込めませんでした。");
 if(!profile.data)redirect("/account/dealer/edit");
 const stats=await dealerReliability(supabase,[user.id]);
 const photo=profile.data.photo_url ? (await supabase.storage.from("dealer-photos").createSignedUrl(profile.data.photo_url,300)).data?.signedUrl ?? null : null;
 return <><PortalHeader userEmail={user.email}/><main className={styles.page}><Link href="/mypage">マイページに戻る</Link><h1 className={styles.heading}>ディーラープロフィール</h1>{searchParams.done && <p className={styles.success} role="status">保存しました。</p>}<p className={styles.hint}>{profile.data.published ? "店舗アカウントに表示中。一般会員には表示されません。" : "本人だけが閲覧できます。"}</p><div className={styles.actions}><Link className="btn primary" href="/account/dealer/chat">応募・オファーのチャット<NotificationBadge actor="dealer"/></Link><Link className="btn primary" href="/account/dealer/edit">プロフィールを編集する</Link><Link className="btn primary" href="/account/dealer/work">✓ 勤務完了・レビューはこちら</Link></div><DealerReliabilityView stats={stats[user.id]} /><DealerReviews db={supabase} id={user.id} page={parseInt(searchParams.reviews||"1",10)} path="/account/dealer"/><DealerDetail profile={profile.data} address={address.data?.address ?? ""} photo={photo}/></main><PortalFooter/></>;
}
