// Real isolated PostgreSQL schema/RPC adapters; no remote database or credentials.
const fs=require('node:fs'),path=require('node:path'),{randomUUID,randomBytes}=require('node:crypto');
const {PGlite}=require(process.env.POKER_PGLITE_MODULE||'@electric-sql/pglite');
module.exports=async function(){const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
 create function public.is_admin() returns boolean language sql stable as $$ select coalesce(nullif(current_setting('test.admin',true),''),'false')::boolean $$;
 create function public.is_suspended() returns boolean language sql stable as $$ select coalesce(nullif(current_setting('test.suspended',true),''),'false')::boolean $$;
 create table public.stores(id uuid primary key,owner_user_id uuid);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
 grant usage on schema public to anon,authenticated,service_role;`);
 const folder=path.resolve(__dirname,'../../supabase/migrations');for(const suffix of ['_poker_tournament_settings.sql','_poker_tournament_store_access.sql','_poker_room_checkpoints.sql','_poker_room_admission.sql','_poker_room_scheduler.sql','_poker_room_lobby.sql','_poker_tournament_registration.sql','_poker_registration_management.sql','_poker_room_startup_discovery.sql']){const file=fs.readdirSync(folder).find(f=>f.endsWith(suffix));await db.exec(fs.readFileSync(path.join(folder,file),'utf8'));}

 const {SupabaseRoomDirectory}=require('../../lib/poker/room-directory.ts'),{SupabaseRoomStore}=require('../../lib/poker/room-persistence.ts');
 const args={poker_room_startup_ids:['p_limit'],poker_registration_management_status:['p_tournament'],poker_registration_configure:['p_tournament','p_capacity','p_enabled'],poker_registration_freeze:['p_tournament','p_expected'],poker_room_load:['p_room'],poker_room_save:['p_room','p_expected','p_write','p_sealed','p_result'],poker_room_binding:['p_room'],poker_room_control:['p_room'],poker_room_provision:['p_room','p_tournament','p_members','p_capacity','p_spectators','p_starts','p_structure'],poker_room_assignments:['p_member'],poker_room_authorize:['p_room','p_member','p_operation'],poker_registration_catalog:['p_member'],poker_registration_change:['p_tournament','p_member','p_action']};
 const client={rpc:async(name,input)=>{try{if(!Object.hasOwn(args,name))throw Error('Unlisted test RPC');const values=args[name].map(k=>input[k]!==null&&typeof input[k]==='object'&&k!=='p_members'?JSON.stringify(input[k]):input[k]);const r=await db.query(`select public.${name}(${args[name].map((key,i)=>key+' => $'+(i+1)).join(',')}) result`,values);return {data:name==='poker_room_save'?Number(r.rows[0].result):r.rows[0].result,error:null};}catch(error){if(process.env.POKER_E2E_DEBUG)console.error('SQL fixture:',name,error.message);return {data:null,error};}}};
 const users=Array.from({length:8},()=>randomUUID());for(const id of users)await db.query('insert into auth.users values($1)',[id]);
 const T=Date.now()+86400000,tid=randomUUID(),structure={startingStack:200,anteType:'bb',lateRegLevel:1,reentry:false,periods:[{kind:'level',minutes:1,sb:50,bb:100,ante:100,note:'E2E only'}]};
 await db.query('insert into public.poker_tournaments(id,title,owner_store_id,starts_at,published,structure) values($1,$2,null,$3,true,$4)',[tid,'隔離テスト大会',new Date(T).toISOString(),JSON.stringify(structure)]);
 await db.exec('set role service_role');const directory=new SupabaseRoomDirectory(client),store=new SupabaseRoomStore(client),keys={active:'test',keys:{test:randomBytes(32)}};
 await directory.configureRegistration(tid,6,true);
 return {db,directory,store,keys,users,T,tid};
};
