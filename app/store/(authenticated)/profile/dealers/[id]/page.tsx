import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { createStoreClient } from "@/lib/supabase/store-server";
import { DealerDetail } from "@/app/account/dealer/detail";
import styles from "@/app/account/dealer/dealer.module.css";
export const dynamic="force-dynamic";
export default async function DealerPage({params}:{params:{id:string}}){
 const supabase=await createStoreClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/store/login?next=/store/profile/dealers");
 if(!/^[0-9a-f-]{36}$/i.test(params.id))notFound();
 const {data:owned,error:ownedError}=await supabase.from("stores").select("id").eq("owner_user_id",user.id).limit(1).maybeSingle();
 if(ownedError||!owned)notFound();
 const [profile,address]=await Promise.all([supabase.from("dealer_profiles").select("*").eq("user_id",params.id).eq("published",true).maybeSingle(),supabase.from("dealer_addresses").select("address").eq("user_id",params.id).maybeSingle()]);
 if(profile.error||address.error)throw new Error("プロフィールを読み込めませんでした。");
 if(!profile.data)notFound();
 const photo=profile.data.photo_url ? (await supabase.storage.from("dealer-photos").createSignedUrl(profile.data.photo_url,300)).data?.signedUrl ?? null : null;
 return <main className={styles.page}><Link href="/store/profile/dealers">← ディーラー一覧に戻る</Link><h1 className={styles.heading}>ディーラー詳細</h1><DealerDetail profile={profile.data} address={address.data?.address ?? ""} photo={photo}/></main>;
}
