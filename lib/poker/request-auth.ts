/** Server-only per-request identity verification. Never use decoded JWT/session metadata as identity. */
import {createClient} from '@supabase/supabase-js';
export class PokerAuthError extends Error {
  constructor(readonly status:401|403|503){super(status===401?'Authentication required':status===403?'Account unavailable':'Authentication unavailable');}
}
export const pokerUUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type VerifiedPokerMember={memberId:string};
export function createSupabasePokerAuthenticator(options:{url:string;publicKey:string;fetch?:typeof fetch;now?:()=>number}) {
  const url=new URL(options.url);
  // Classify CONFIGURATION only; this never verifies a user's token/identity.
  let publicKey=options.publicKey?.startsWith('sb_publishable_');
  if(!publicKey){try{publicKey=JSON.parse(Buffer.from(options.publicKey.split('.')[1],'base64url').toString('utf8')).role==='anon';}catch{publicKey=false;}}
  if(!['https:','http:'].includes(url.protocol)||!publicKey)throw new Error('Invalid public Auth configuration');
  // New client for EVERY verification. No cross-request session or service-role client reuse.
  return async(token:string):Promise<VerifiedPokerMember>=>{
    try {
      const client=createClient(options.url,options.publicKey,{global:{headers:{Authorization:`Bearer ${token}`},...(options.fetch?{fetch:options.fetch}:{})},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
      const {data,error}=await client.auth.getUser(token),user=data?.user;
      if(error||!user)throw new PokerAuthError(401);
      if(!pokerUUID.test(user.id)||user.aud!=='authenticated'||user.role!=='authenticated'||user.is_anonymous===true||user.deleted_at)throw new PokerAuthError(403);
      if(user.banned_until){const until=Date.parse(user.banned_until),now=(options.now??Date.now)();if(!Number.isSafeInteger(now))throw new PokerAuthError(503);if(!Number.isFinite(until)||until>now)throw new PokerAuthError(403);}
      // Existing application RPC checks current suspension using THIS JWT's auth.uid().
      const suspended=await client.rpc('is_suspended');
      if(suspended.error||suspended.data!==false)throw new PokerAuthError(suspended.error?503:403);
      return {memberId:user.id.toLowerCase()};
    }catch(error){if(error instanceof PokerAuthError)throw error;throw new PokerAuthError(503);}
  };
}
