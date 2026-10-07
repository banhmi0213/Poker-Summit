import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { DealerForm } from "../form";
import styles from "../dealer.module.css";
export const dynamic="force-dynamic";
export default async function DealerEditPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login?next=/account/dealer/edit");
 const [result,address,contacts]=await Promise.all([supabase.from("dealer_profiles").select("*").eq("user_id",user.id).maybeSingle(),supabase.from("dealer_addresses").select("address").eq("user_id",user.id).maybeSingle(),supabase.from("dealer_private_contacts").select("phone,contact_type,contact_value,disclosure_consented_at").eq("user_id",user.id).maybeSingle()]);
 if(result.error||address.error||contacts.error)throw new Error("登録情報を読み込めませんでした。");
 const photo=result.data?.photo_url ? (await supabase.storage.from("dealer-photos").createSignedUrl(result.data.photo_url,300)).data?.signedUrl ?? null : null;
 return <><PortalHeader userEmail={user.email}/><main className={styles.page}><Link href="/mypage">← マイページに戻る</Link><h1 className={styles.heading}>{result.data ? "ディーラープロフィール編集" : "ディーラー登録"}</h1><DealerForm contacts={contacts.data} profile={result.data} address={address.data?.address ?? ""} photo={photo} today={new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"})}/></main><PortalFooter/></>;
}

