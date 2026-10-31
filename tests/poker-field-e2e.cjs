/** Multi-table tournament end to end (owner 2026/10/30: no 7-player test day, so the first freeroll must just work).
 * 24 entrants: 22 scripted players over the real HTTP API + 2 real browsers (desktop and phone) through the real
 * table UI, against the real room service, durable owner, encrypted checkpoints and isolated PostgreSQL with the
 * production migrations. Registration closes by itself 10 minutes before the start; tables are drawn, balanced,
 * broken and merged to a final table; places are archived. Fixtures only: no live Supabase, nothing in production.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript'),http=require('node:http'),{randomUUID,randomBytes}=require('node:crypto');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const root=path.resolve(__dirname,'..'),{createPokerRoomService}=require('../lib/poker/room-service.ts'),{restoreRoom}=require('../lib/poker/room-persistence.ts');
const ENTRANTS=Number(process.env.POKER_FIELD_ENTRANTS||24),STACK=1000,BROWSERS=2;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(read,predicate,label,ms=20000)=>{const end=Date.now()+ms;do{const v=await read();if(predicate(v))return v;await sleep(50);}while(Date.now()<end);throw Error('Timed out: '+label);};

async function database(){
 const {PGlite}=require(process.env.POKER_PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
 create function public.is_admin() returns boolean language sql stable as $$ select coalesce(nullif(current_setting('test.admin',true),''),'false')::boolean $$;
 create function public.is_suspended() returns boolean language sql stable as $$ select coalesce(nullif(current_setting('test.suspended',true),''),'false')::boolean $$;
 create table public.stores(id uuid primary key,owner_user_id uuid);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
 grant usage on schema public to anon,authenticated,service_role;`);
 const folder=path.resolve(__dirname,'../supabase/migrations');
 for(const suffix of ['_poker_tournament_settings.sql','_poker_tournament_store_access.sql','_poker_room_checkpoints.sql','_poker_room_admission.sql','_poker_room_scheduler.sql','_poker_room_lobby.sql','_poker_tournament_registration.sql','_poker_registration_management.sql','_poker_room_startup_discovery.sql','_poker_statistics.sql','_poker_targeted_entry.sql','_poker_targeted_policy_guard.sql','_poker_multi_table_tournaments.sql','_poker_field_100.sql']){
  const file=fs.readdirSync(folder).find(f=>f.endsWith(suffix));assert.ok(file,suffix);await db.exec(fs.readFileSync(path.join(folder,file),'utf8'));
 }
 const {SupabaseRoomDirectory}=require('../lib/poker/room-directory.ts'),{SupabaseRoomStore}=require('../lib/poker/room-persistence.ts');
 const args={poker_room_startup_ids:['p_limit'],poker_registration_management_status:['p_tournament'],poker_registration_configure:['p_tournament','p_capacity','p_enabled'],poker_registration_freeze:['p_tournament','p_expected'],poker_room_load:['p_room'],poker_room_save:['p_room','p_expected','p_write','p_sealed','p_result'],poker_room_binding:['p_room'],poker_room_control:['p_room'],poker_room_provision:['p_room','p_tournament','p_members','p_capacity','p_spectators','p_starts','p_structure'],poker_room_assignments:['p_member'],poker_room_authorize:['p_room','p_member','p_operation'],poker_registration_catalog:['p_member'],poker_registration_change:['p_tournament','p_member','p_action'],poker_entry_due:[],poker_room_tournament_config:['p_tournament']};
 const client={rpc:async(name,input)=>{try{if(!Object.hasOwn(args,name))throw Error('Unlisted test RPC '+name);const values=args[name].map(k=>input[k]!==null&&typeof input[k]==='object'&&k!=='p_members'?JSON.stringify(input[k]):input[k]);const r=await db.query(`select public.${name}(${args[name].map((key,i)=>key+' => $'+(i+1)).join(',')}) result`,values);return {data:name==='poker_room_save'?Number(r.rows[0].result):r.rows[0].result,error:null};}catch(error){if(process.env.POKER_E2E_DEBUG)console.error('SQL fixture:',name,error.message);return {data:null,error};}}};
 const users=Array.from({length:ENTRANTS},()=>randomUUID());
 for(let i=0;i<users.length;i++)await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)",[users[i],`field${i}@example.test`,JSON.stringify({display_name:'プレイヤー'+i})]);
 // Starts 6 real minutes from now: inside the 10-minute window, so the open registration closes by itself.
 const startsAt=new Date(Math.ceil((Date.now()+6*60000)/1000)*1000).toISOString(),tid=randomUUID();
 const structure={startingStack:STACK,anteType:'bb',lateRegLevel:1,reentry:false,timeBankCards:1,finalTableCards:1,periods:[[25,50],[50,100],[75,150],[100,200],[150,300],[200,400],[300,600],[500,1000]].map(([sb,bb])=>({kind:'level',minutes:3,sb,bb,ante:bb,note:'E2E only'}))};
 await db.query('insert into public.poker_tournaments(id,title,owner_store_id,starts_at,published,structure) values($1,$2,null,$3,true,$4)',[tid,'複数卓テスト大会',startsAt,JSON.stringify(structure)]);
 await db.exec('set role service_role');
 const directory=new SupabaseRoomDirectory(client),store=new SupabaseRoomStore(client),keys={active:'test',keys:{test:randomBytes(32)}};
 await directory.configureRegistration(tid,Math.max(ENTRANTS,24),true);
 return {db,directory,store,keys,users,tid,startsAt:Date.parse(startsAt)};
}

(async()=>{
 const esbuild=require(process.env.POKER_ESBUILD_MODULE||'esbuild'),raw=require(process.env.POKER_CHROMIUM_MODULE),chromium=raw.default??raw,{chromium:pw}=require(process.env.POKER_PLAYWRIGHT_MODULE),output=process.env.POKER_E2E_OUTPUT??'/tmp/poker-field-e2e';fs.mkdirSync(output,{recursive:true});
 await esbuild.build({entryPoints:[path.join(__dirname,'helpers/poker-browser-entry.tsx')],outfile:path.join(output,'client.js'),bundle:true,format:'iife',platform:'browser',jsx:'automatic',loader:{'.css':'local-css'},external:['/images/*'],alias:{'@/lib/supabase/client':path.join(__dirname,'helpers/poker-browser-auth.ts'),'@':root},define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
 const f=await database();let now=Date.now(),service=null,backend='',events='',roomId=null,browser=null;const errors=[],pages=[],contexts=[],latest=new Map();let checks=0;
 const check=(condition,label)=>{assert.ok(condition,label);checks++;};
 const gateway=http.createServer(async(req,res)=>{try{
  if(req.url.startsWith('/api/poker/')){const chunks=[];for await(const b of req)chunks.push(b);const body=Buffer.concat(chunks);const upstream=await fetch(backend+req.url,{method:'POST',headers:{origin:req.headers.origin??'',authorization:req.headers.authorization??'','content-type':'application/json',...(req.headers['x-poker-connection']?{'x-poker-connection':req.headers['x-poker-connection']}:{})},body,signal:AbortSignal.timeout(10000)});const content=Buffer.from(await upstream.arrayBuffer());res.writeHead(upstream.status,Object.fromEntries(upstream.headers));res.end(content);return;}
  if(req.url==='/client.js'||req.url==='/client.css'){res.writeHead(200,{'Content-Type':req.url.endsWith('.js')?'text/javascript':'text/css','Cache-Control':'no-store'});res.end(fs.readFileSync(path.join(output,req.url.slice(1))));return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><link rel="stylesheet" href="/client.css"><style>body{margin:0;font-family:sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script>window.POKER_E2E_EVENTS=${JSON.stringify(events)}</script><script defer src="/client.js"></script></body></html>`);
 }catch{if(!res.destroyed){res.writeHead(503);res.end('{"ok":false}');}}});
 await new Promise(r=>gateway.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+gateway.address().port;
 const token=i=>'field-'+i;
 const auth={url:'https://isolated.supabase.co',publicKey:'sb_publishable_e2e',fetch:async(url,init)=>{const t=new Headers(init?.headers).get('authorization')?.replace('Bearer ',''),m=/^field-(\d+)$/.exec(t??''),i=m?Number(m[1]):-1;if(i<0||i>=f.users.length)return Response.json({message:'invalid'},{status:401});return Response.json(String(url).endsWith('/auth/v1/user')?{id:f.users[i],aud:'authenticated',role:'authenticated',is_anonymous:false}:String(url).endsWith('/rpc/is_suspended')?false:false);}};
 const options={registry:{directory:f.directory,store:f.store,keys:f.keys,now:()=>now,turnMs:15000,handPauseMs:1000},auth,origins:[origin]};
 async function start(port=0){service=createPokerRoomService({...options,port});const a=await service.start();backend='http://127.0.0.1:'+a.port;events='ws://127.0.0.1:'+a.port;return a.port;}
 const api=async(i,body,connection)=>{const r=await fetch(backend+'/api/poker/rooms/'+roomId,{method:'POST',headers:{origin,authorization:'Bearer '+token(i),'content-type':'application/json',...(connection?{'x-poker-connection':connection}:{})},body:JSON.stringify(body)});const b=await r.json().catch(()=>({}));return {status:r.status,result:b.result};};
 const saved=async()=>{const v=await restoreRoom(f.store,roomId,f.keys,{now:()=>now});assert.ok(v);return v.room.checkpoint();};
 const where=c=>{const map=new Map();for(const [t,room] of c.field?.tables??[])for(const [seat,s] of room.seats)map.set(s.memberId,{table:t,seat,stack:s.stack});return map;};
 const allIn=async(p,legal)=>{const panel=p.getByRole('region',{name:'操作パネル',exact:true}),label=legal.shortAllInOnly?/^オールイン(?!コール)/:/^(レイズ|ベット)/;
  if((p.viewportSize()?.width??1280)<900){await panel.getByRole('button',{name:label}).first().click();const editor=panel.getByRole('dialog',{name:'ベット額を選択'});await editor.getByRole('button',{name:/^ALL-IN額/}).click();await editor.getByRole('button',{name:/^(レイズ|ベット|オールイン) /}).click();return;}
  await p.getByRole('button',{name:'ALL-IN額',exact:true}).click();await panel.getByRole('button',{name:label}).click();};
 try{
  const port=await start();
  // 1. Open registration through the real lobby API for everyone; it closes by itself (start - 10 min).
  for(let i=0;i<ENTRANTS;i++)check((await f.directory.changeRegistration(f.users[i],f.tid,'register')).ok,'registered '+i);
  roomId=(await until(()=>f.directory.managementStatus(f.tid),s=>s.finalization?.assigned,'automatic finalization',30000)).finalization.roomId;
  check((await f.directory.binding(roomId)).capacity===100,'multi-table capacity');console.log(`PASS ${ENTRANTS} open registrations closed automatically into one room`);
  // 2. Seats are drawn before the start; nobody is dealt in.
  let c=await until(saved,c=>Boolean(c.field),'seat draw');const tables=c.field.tables.length;check(tables===Math.ceil(ENTRANTS/6),'tables drawn');
  for(const [,t] of c.field.tables)check(t.seats.length>=3&&t.seats.length<=6,'table size');check(c.field.tables.every(([,t])=>t.hand===null),'no hand before the start');
  // 3. Two real browsers (desktop + phone) join through the table UI; the rest are scripted players over HTTP.
  browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args.filter(a=>!['--single-process','--disable-web-security','--allow-running-insecure-content'].includes(a)),headless:true});
  for(let i=0;i<BROWSERS;i++){const ctx=await browser.newContext({viewport:i===1?{width:390,height:844}:{width:1280,height:800}});contexts.push(ctx);await ctx.addInitScript(({t})=>{sessionStorage.setItem('poker-e2e-token',t);},{t:token(i)});
   const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',async r=>{if(!r.url().includes('/api/poker/rooms/'))return;try{const b=await r.json();if(!b.ok)return;const s=b.result.state??b.result;if(!Number.isSafeInteger(s.revision))return;latest.set(i,s);const json=JSON.stringify(s);for(const u of f.users)if(json.includes(u))errors.push('member id in a view');}catch{}});
   pages.push(page);await page.goto(origin+'/poker-online/'+roomId);await page.getByRole('button',{name:'参加・接続・再接続',exact:true}).click();await until(()=>latest.get(i),s=>s?.youSeat!=null,'browser join '+i);
  }
  const at=where(c);for(let i=0;i<BROWSERS;i++){const me=at.get(f.users[i]);check(latest.get(i).youSeat===me.seat&&latest.get(i).field.tableNumber===me.table,'browser sees its drawn table and seat');}
  await until(()=>pages[0].getByText(/第\d+卓（全\d+卓）/).count(),n=>n>0,'table number shown');
  const conn=new Map();const bot=async i=>{if(!conn.has(i)){const r=await api(i,{type:'join'});if(r.status!==200)return null;conn.set(i,r.result.connectionId);}return conn.get(i);};
  for(let i=BROWSERS;i<ENTRANTS;i++)check(Boolean(await bot(i)),'scripted player joined '+i);
  console.log(`PASS ${tables} tables drawn before the start; browsers see their own table`);
  // 4. Play to the end. Scripted players shove or call often to move the tournament along.
  now=f.startsAt;let iterations=0,moves=0,breaks=0,maxTables=tables,finalTable=false,browserMoveShown=false,restarted=false;const seenMoves=new Set();
  while(iterations++<Math.max(6000,ENTRANTS*400)){
   c=await saved();const field=c.field;
   const total=field.tables.reduce((n,[,t])=>n+t.seats.reduce((a,[,s])=>a+s.stack,0),0);check(total===ENTRANTS*STACK,'chips conserved across tables');
   for(const [,t] of field.tables)check(t.seats.length<=6,'never more than 6 at a table');
   maxTables=Math.max(maxTables,field.tables.length);if(field.tables.length===1&&[...where(c).values()].filter(s=>s.stack>0).length<=6)finalTable=true;
   for(const [m,mv] of field.moved){const key=m+mv.at;if(!seenMoves.has(key)){seenMoves.add(key);moves++;}}
   if(field.champion)break;
   // A mid-tournament restart of the whole service must continue the same tournament.
   if(!restarted&&field.eliminated.length>=Math.floor(ENTRANTS/3)){restarted=true;await service.close();service=null;await start(port);conn.clear();
    for(let i=0;i<BROWSERS;i++){if(!where(await saved()).has(f.users[i]))continue;latest.delete(i);await pages[i].getByRole('button',{name:'参加・接続・再接続',exact:true}).click().catch(()=>{});}
    console.log('PASS service restart mid-tournament');continue;}
   let acted=false;
   for(const [tableNo,t] of field.tables){
    if(!t.turn)continue;const seatNo=Number(t.turn.actor.slice(5)),member=t.seats.find(([n])=>n===seatNo)?.[1].memberId,i=f.users.indexOf(member);if(i<0)continue;
    if(i<BROWSERS){
     const p=pages[i];const s=await until(()=>latest.get(i),v=>v?.hand?.handId===t.turn.handId&&v.hand.revision===t.turn.revision&&v.hand.legal,'browser turn '+i,8000).catch(()=>null);
     if(!s){await pages[i].getByRole('button',{name:'参加・接続・再接続',exact:true}).click().catch(()=>{});continue;}
     check(s.field.tableNumber===tableNo,'browser acts at its own table');
     const legal=s.hand.legal,ack=p.waitForResponse(r=>r.url().includes('/api/poker/rooms/')&&r.request().postDataJSON()?.type==='act',{timeout:8000}).catch(()=>null);
     const roll=Math.random(),panel=p.getByRole('region',{name:'操作パネル',exact:true});
     if(legal.raise&&roll<0.5)await allIn(p,legal);else if(legal.call&&roll<0.75)await panel.getByRole('button',{name:/^(コール|オールイン)/}).first().click();else if(legal.check)await p.getByRole('button',{name:'チェック',exact:true}).click();else await p.getByRole('button',{name:'フォールド',exact:true}).click();
     await ack;acted=true;break;
    }
    const connection=await bot(i);if(!connection)continue;let r=await api(i,{type:'state'},connection);
    if(r.status!==200){conn.delete(i);continue;}const s=r.result,legal=s.hand?.legal;if(!legal||s.hand.handId!==t.turn.handId)continue;
    check(s.field.tableNumber===tableNo,'scripted player sees its own table');
    const roll=Math.random();let action;
    if(legal.raise&&roll<0.35)action={type:legal.check?'bet':'raise',amount:legal.maxRaiseTo};else if(legal.call&&roll<0.75)action={type:'call'};else if(legal.check)action={type:'check'};else action={type:'fold'};
    const send=a=>api(i,{type:'act',command:{handId:s.hand.handId,revision:s.hand.revision,actionId:randomUUID(),action:a}},connection);
    r=await send(action);if(r.status===409&&['bet','raise'].includes(action.type))r=await send({...action,type:action.type==='bet'?'raise':'bet'});
    acted=true;break;
   }
   // Browser view after a move: the notice appears and the new table is shown.
   for(let i=0;i<BROWSERS;i++){const s=latest.get(i);if(s?.field?.moved&&!browserMoveShown){if(await pages[i].getByText(/第\d+卓から第\d+卓へ移動しました/).count())browserMoveShown=true;}}
   if(!acted){now+=1500;await sleep(120);}else await sleep(5);
  }
  c=await saved();check(Boolean(c.field.champion),'tournament finished');check(c.field.eliminated.length===ENTRANTS-1,'every other player placed');
  check(maxTables===Math.ceil(ENTRANTS/6),'started on all tables');check(finalTable,'merged down to one final table');check(moves>0,'players were moved between tables');
  // 5. Results: one record per hand, final standings archived for all entrants.
  const logs=(await f.db.query('select count(*)::int n,count(distinct hand_id)::int u from poker_private.hand_results where room_id=$1',[roomId])).rows[0];check(logs.n===logs.u&&logs.n>0,'one result record per hand');
  const finish=(await f.db.query('select standings from poker_private.tournament_finishes where tournament_id=$1',[f.tid])).rows[0];check(Boolean(finish),'tournament archived');
  const standings=finish.standings;check(standings.length===ENTRANTS,'standings for every entrant');check(standings.filter(r=>r.place===1).length===1,'one winner');check(new Set(standings.map(r=>r.memberId)).size===ENTRANTS,'each member once');
  const champion=standings.find(r=>r.place===1).memberId;check(champion===c.field.champion,'archived champion matches the table');
  for(let i=0;i<BROWSERS;i++)await until(()=>pages[i].getByText(/大会終了/).count(),n=>n>0,'finish shown '+i,45000);
  for(let i=0;i<BROWSERS;i++){const mine=standings.find(r=>r.memberId===f.users[i]);await until(()=>pages[i].getByText(mine.place===1?'あなたが優勝しました！':new RegExp(`あなたは${mine.place}`)).count(),n=>n>0,'own place shown '+i,45000);}
  check(errors.length===0,'no browser errors: '+errors.join(';'));
  await pages[1].screenshot({path:path.join(output,'mobile-finished.png'),fullPage:true});
  console.log('PASS field played to the end: balancing, table breaks, final table, places archived');
  console.log(JSON.stringify({entrants:ENTRANTS,tables,moves,browserMoveShown,hands:logs.n,iterations,checks,errors:errors.length,liveSupabase:false,productionChanged:false}));
 }catch(e){console.error('E2E browser errors:',errors);if(pages[0]){console.error('E2E page text:',(await pages[0].locator('body').innerText().catch(()=>'')).slice(0,600));await pages[0].screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});}throw e;}
 finally{if(service)await service.close();if(browser)await browser.close();await new Promise(r=>gateway.close(r));await f.db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
