// Isolated PostgreSQL test via PGlite. NEVER points at a remote/live database.
// Optional dev tool: npm install --prefix /tmp/poker-sql-check @electric-sql/pglite
// POKER_PGLITE_MODULE=/tmp/poker-sql-check/node_modules/@electric-sql/pglite node db/tests/poker_tournaments_isolated.cjs
const {PGlite}=require(process.env.POKER_PGLITE_MODULE||'@electric-sql/pglite');
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {defaultStructure}=require('../../lib/poker/tournament.ts');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',ADMIN='33333333-3333-4333-8333-333333333333',STRANGER='44444444-4444-4444-8444-444444444444';
const SA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',SB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
(async()=>{
 const db=new PGlite();let checks=0;const check=(v)=>{assert.ok(v);checks++;};
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid',true),'')::uuid $$;
 create function public.is_admin() returns boolean language sql stable as $$ select auth.uid()='${ADMIN}'::uuid $$;
 create function public.is_suspended() returns boolean language sql stable as $$ select coalesce(current_setting('app.suspended',true),'false')='true' $$;
 create table public.stores(id uuid primary key,owner_user_id uuid,name text);
 insert into public.stores values('${SA}','${A}','A'),('${SB}','${B}','B');
 grant usage on schema auth,storage to anon,authenticated;grant select on public.stores to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;`);
 await db.exec(fs.readFileSync('supabase/migrations/20261016180000_poker_tournament_settings.sql','utf8'));
 const auth=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('app.uid',$1,false)",[id]);await db.exec(`set role ${role}`);};
 const insert=async(owner,title,published=false,structure=defaultStructure)=>db.query('insert into poker_tournaments(owner_store_id,title,starts_at,published,structure) values($1,$2,now(),$3,$4) returning id',[owner,title,published,JSON.stringify(structure)]);
 await auth(ADMIN);const global=(await insert(null,'global')).rows[0].id;check(Boolean(global));
 await auth(A);const own=(await insert(SA,'A draft')).rows[0].id;const published=(await insert(SA,'A published',true)).rows[0].id;check(Boolean(own)&&Boolean(published));
 await assert.rejects(()=>insert(SB,'spoof B'));checks++;
 await assert.rejects(()=>insert(null,'spoof admin'));checks++;
 await auth(B);check((await db.query('select id from poker_tournaments where id=$1',[own])).rows.length===0);
 check((await db.query('update poker_tournaments set title=$1 where id=$2 returning id',['hacked',own])).rows.length===0);
 check((await db.query('select id from poker_tournaments where id=$1',[published])).rows.length===1);
 await auth('','anon');check((await db.query('select id from poker_tournaments')).rows.length===1);
 await auth(ADMIN);check((await db.query('select id from poker_tournaments')).rows.length===3);
 check((await db.query('update poker_tournaments set title=$1 where id=$2 returning id',['admin edited',own])).rows.length===1);
 await auth(A);check((await db.query('update poker_tournaments set published=false where id=$1 returning id',[published])).rows.length===1);
 for(const patch of [{startingStack:null},{anteType:null},{periods:[{kind:null,minutes:10,sb:0,bb:0,ante:0,note:''}]},{lateRegLevel:99},{startingStack:1.2},{periods:[]}]){
  const bad={...defaultStructure,...patch};await assert.rejects(()=>insert(SA,'invalid',false,bad));checks++;
 }
 const missing={...defaultStructure};delete missing.anteType;await assert.rejects(()=>insert(SA,'missing',false,missing));checks++;
 await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['poker-tournament-images',`${A}/file.png`]);checks++;
 await assert.rejects(()=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['poker-tournament-images',`${B}/file.png`]));checks++;
 await auth(STRANGER);await assert.rejects(()=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['poker-tournament-images',`${STRANGER}/file.png`]));checks++;
 await auth(A);await db.query("select set_config('app.suspended','true',false)");await assert.rejects(()=>insert(SA,'suspended'));checks++;
 await db.exec('reset role');check((await db.query('select count(*)::int as n from poker_tournaments')).rows[0].n===3);
 console.log(`PASS: migration applied in isolated PostgreSQL; ${checks} schema/RLS/storage assertions. No remote database accessed.`);
 await db.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
