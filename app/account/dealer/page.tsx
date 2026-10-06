import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { DealerDetail } from "./detail";
import styles from "./dealer.module.css";
export const dynamic="force-dynamic";
export default async function MyDealerPage({searchParams}:{searchParams:{done?:string}}){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login?next=/account/dealer");
 const [profile,address]=await Promise.all([supabase.from("dealer_profiles").select("*").eq("user_id",user.id).maybeSingle(),supabase.from("dealer_addresses").select("address").eq("user_id",user.id).maybeSingle()]);
 if(profile.error||address.error)throw new Error("登録情報を読み込めませんでした。");
 if(!profile.data)redirect("/account/dealer/edit");
 const photo=profile.data.photo_url ? (await supabase.storage.from("dealer-photos").createSignedUrl(profile.data.photo_url,300)).data?.signedUrl ?? null : null;
 return <><PortalHeader userEmail={user.email}/><main className={styles.page}><Link href="/mypage">← マイページに戻る</Link><h1 className={styles.heading}>ディーラープロフィール</h1>{searchParams.done && <p className={styles.success} role="status">保存しました。</p>}<p className={styles.hint}>{profile.data.published ? "店舗アカウントに表示中。一般会員には表示されません。" : "本人だけが閲覧できます。"}</p><div className={styles.actions}><Link className="btn primary" href="/account/dealer/edit">プロフィールを編集する</Link></div><DealerDetail profile={profile.data} address={address.data?.address ?? ""} photo={photo}/></main><PortalFooter/></>;
}
