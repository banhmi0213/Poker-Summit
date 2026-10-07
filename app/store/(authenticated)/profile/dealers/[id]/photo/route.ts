import {createStoreClient} from "@/lib/supabase/store-server";
import {UUID} from "@/lib/spot-jobs";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:{id:string}}){
 const headers={"Cache-Control":"private, no-store, max-age=0","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
 const db=await createStoreClient();
 const {data:{user}}=await db.auth.getUser();
 if(!user)return new Response(null,{status:401,headers});
 if(!UUID.test(params.id))return new Response(null,{status:404,headers});
 const [store,suspended]=await Promise.all([db.from("stores").select("id").eq("owner_user_id",user.id).limit(1).maybeSingle(),db.rpc("is_suspended")]);
 if(store.error||suspended.error||!store.data||suspended.data)return new Response(null,{status:403,headers});
 const {data:profile,error}=await db.from("dealer_profiles").select("photo_url").eq("user_id",params.id).eq("published",true).maybeSingle();
 if(error||!profile?.photo_url||!profile.photo_url.startsWith(params.id+"/"))return new Response(null,{status:404,headers});
 const {data:image,error:imageError}=await db.storage.from("dealer-photos").download(profile.photo_url);
 if(imageError||!image)return new Response(null,{status:404,headers});
 const type=image.type;
 if(!["image/jpeg","image/png","image/webp"].includes(type))return new Response(null,{status:404,headers});
 return new Response(await image.arrayBuffer(),{headers:{...headers,"Content-Type":type}});
}
