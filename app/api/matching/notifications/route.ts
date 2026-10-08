import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createStoreClient} from '@/lib/supabase/store-server';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const actor=request.nextUrl.searchParams.get('actor');if(actor!=='store'&&actor!=='dealer')return NextResponse.json({error:'Invalid actor'},{status:400});
 const db=actor==='store'?await createStoreClient():await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({count:0},{status:401});
 const {count,error}=await db.from('matching_notifications').select('id',{count:'exact',head:true}).eq('recipient_id',user.id).eq('recipient_actor',actor).is('read_at',null);
 return NextResponse.json(error?{error:'Unavailable'}:{count:count||0},{status:error?503:200,headers:{'Cache-Control':'private, no-store'}});
}
