/** Preview must use the separate staging DB, even if Vercel inherited production variables.
 * Production and local fixtures keep their existing configuration. Project refs are public IDs. */
export function gtoUsageDatabaseReady(env:{VERCEL_ENV?:string;NEXT_PUBLIC_SUPABASE_URL?:string}=process.env){
 if(env.VERCEL_ENV!=='preview')return true;
 try{return new URL(env.NEXT_PUBLIC_SUPABASE_URL??'').hostname==='mjdgylgzhsygcgtuceow.supabase.co';}catch{return false;}
}
