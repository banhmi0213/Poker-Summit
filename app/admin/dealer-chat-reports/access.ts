import {createClient} from "@/lib/supabase/server";
import {notFound,redirect} from "next/navigation";
export async function reportAccess(){const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect("/admin-login");const result=await db.from("admin_users").select("user_id").eq("user_id",user.id).eq("active",true).maybeSingle();if(result.error||!result.data)notFound();return db;}
