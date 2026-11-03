// Disposable PostgreSQL only; no remote database, real credentials or network.
const {PGlite}=require(process.env.POKER_PGLITE_MODULE||'@electric-sql/pglite'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript'),{randomUUID,randomBytes}=require('node:crypto');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {DurableRoomOwner}=require('../../lib/poker/durable-room-owner.ts');
const {SupabaseRoomStore}=require('../../lib/poker/room-persistence.ts'),{SupabaseRoomDirectory}=require('../../lib/poker/room-directory.ts'),{TournamentRoomRegistry}=require('../../lib/poker/tournament-room-registry.ts'),{createPokerPlayerHandler}=require('../../lib/poker/player-request-handler.ts');
(async()=>{const db=new PGlite();let checks=0;const ok=(a,b)=>{assert.deepEqual(a,b);checks++;},reject=async f=>{await assert.rejects(f);checks++;};
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
 create function public.is_admin() returns boolean language sql stable as $$ select false $$;
 create function public.is_suspended() returns boolean language sql stable as $$ select false $$;
 create table public.stores(id uuid primary key,owner_user_id uuid);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
 grant usage on schema public to anon,authenticated,service_role;`);
 const folder=path.resolve(__dirname,'../../supabase/migrations');for(const suffix of ['_poker_tournament_settings.sql','_poker_room_checkpoints.sql','_poker_room_admission.sql','_poker_room_scheduler.sql','_poker_room_lobby.sql']){const file=fs.readdirSync(folder).find(f=>f.endsWith(suffix));await db.exec(fs.readFileSync(path.join(folder,file),'utf8'));}
 const T=Math.ceil(Date.now()/1000)*1000+86400000,structure={startingStack:1000,anteType:'bb',lateRegLevel:1,reentry:false,periods:[{kind:'level',minutes:1,sb:50,bb:100,ante:100,note:''}]},tid=randomUUID(),draft=randomUUID(),room=randomUUID(),room2=randomUUID(),users=Array.from({length:8},()=>randomUUID());
 for(const id of users)await db.query('insert into auth.users values($1)',[id]);
 for(const [id,pub] of [[tid,true],[draft,false]])await db.query('insert into public.poker_tournaments(id,title,starts_at,published,structure) values($1,$2,$3,$4,$5)',[id,'test',new Date(T).toISOString(),pub,JSON.stringify(structure)]);
 const args={poker_room_assignments:['p_member'],poker_room_load:['p_room'],poker_room_save:['p_room','p_expected','p_write','p_sealed','p_result'],poker_room_tournament_config:['p_tournament'],poker_room_binding:['p_room'],poker_room_control:['p_room'],poker_room_authorize:['p_room','p_member','p_operation'],poker_room_provision:['p_room','p_tournament','p_members','p_capacity','p_spectators','p_starts','p_structure']};
 const rpc=async(name,input)=>{try{const values=args[name].map(k=>input[k]!==null&&typeof input[k]==='object'&&k!=='p_members'?JSON.stringify(input[k]):input[k]);const q=await db.query(`select public.${name}(${values.map((_,i)=>'$'+(i+1)).join(',')}) as result`,values);let data=q.rows[0].result;if(name==='poker_room_save')data=Number(data);return {data,error:null};}catch(error){return {data:null,error};}};
 const client={rpc},directory=new SupabaseRoomDirectory(client),store=new SupabaseRoomStore(client),keys={active:'test',keys:{test:randomBytes(32)}};let now=T-1000;const options={directory,store,keys,now:()=>now},registry=new TournamentRoomRegistry(options);
 await db.exec('set role service_role');ok(await directory.tournament(draft),null);ok(await directory.binding(room),null);ok(await directory.authorize({memberId:users[0],roomId:room,operation:'seat'}),false);
 const owner=await registry.provision(room,tid,users.slice(0,2),{capacity:2,allowSpectators:true});ok(owner.health.version,1);const binding=await directory.binding(room);ok(binding.capacity,2);ok(binding.structure,structure);const control=await directory.control(room);ok(control.expectedCount,2);ok([...control.members].sort(),users.slice(0,2).sort());ok(control.published,true);ok(await directory.control(randomUUID()),null);
 // Exact roster retry is harmless, changed roster/capacity/config cannot overwrite it.
 await directory.provision(binding,[users[1],users[0]]);checks++;
 await reject(directory.provision({...binding,capacity:6},users.slice(0,2)));
 await reject(directory.provision(binding,users.slice(1,3)));
 const other=await registry.provision(room2,tid,users.slice(2,8),{capacity:6,allowSpectators:false});ok(other.health.version,1);ok((await directory.binding(room2)).capacity,6);
 const ownRooms=await directory.assignments(users[0]);ok(ownRooms.length,1);ok(ownRooms[0].roomId,room);ok(ownRooms[0].capacity,2);ok(ownRooms[0].published,true);ok(Object.keys(ownRooms[0]).sort(),['capacity','published','roomId','starts_at','title','tournamentId']);ok((await directory.assignments(users[7]))[0].roomId,room2);ok(await directory.assignments(randomUUID()),[]);ok(await directory.assignments(users[0]),ownRooms);
 const duplicate=randomUUID();await reject(registry.provision(duplicate,tid,[users[0],users[3]],{capacity:2,allowSpectators:false}));ok(await directory.binding(duplicate),null);
 // Direct SQL boundary also enforces stale config, duplicate roster and pristine-state guards.
 const freshId=randomUUID(),fresh=await DurableRoomOwner.create(binding,{...options,roomId:freshId});
 await reject(directory.provision({...binding,roomId:freshId,starts_at:new Date(T+1000).toISOString()},users.slice(0,2)));
 await reject(directory.provision({...binding,roomId:freshId,structure:{...structure,startingStack:2000}},users.slice(0,2)));
 const rawProvision={p_room:freshId,p_tournament:tid,p_members:[users[0],users[0]],p_capacity:2,p_spectators:false,p_starts:new Date(T).toISOString(),p_structure:structure};
 ok(Boolean((await rpc('poker_room_provision',rawProvision)).error),true);
 ok(Boolean((await rpc('poker_room_provision',{...rawProvision,p_members:users.slice(0,2),p_capacity:4})).error),true);
 ok(Boolean((await rpc('poker_room_provision',{...rawProvision,p_members:null})).error),true);
 await fresh.seat(users[0],1);await reject(directory.provision({...binding,roomId:freshId},users.slice(0,2)));
 const absentMembers=randomUUID();await reject(registry.provision(absentMembers,tid,[randomUUID(),randomUUID()],{capacity:2,allowSpectators:false}));ok(await directory.binding(absentMembers),null);
 const can=(memberId,operation,id=room)=>directory.authorize({memberId,roomId:id,operation});
 for(const op of ['seat','connect','state','act','disconnect','leave','spectate'])ok(await can(users[0],op),true);
 for(const op of ['seat','connect','state','act','disconnect','leave'])ok(await can(users[2],op),false);
 ok(await can(users[2],'spectate'),true);ok(await can(users[0],'spectate',room2),false);ok(await can(users[0],'state',room2),false);ok(await can(users[0],'recover'),false);
 // Handler -> real directory RPC -> cached durable owner -> real checkpoint RPC.
 const origin='https://poker.example',handle=createPokerPlayerHandler({origins:[origin],verify:async token=>({memberId:users[Number(token)]}),authorize:a=>registry.authorize(a),owner:id=>registry.owner(id)});
 const send=async(type,index,token,extra={})=>{const request=new Request(origin+'/poker',{method:'POST',headers:{origin,'content-type':'application/json',authorization:'Bearer '+index,...(token?{'x-poker-connection':token}:{})},body:JSON.stringify({type,...extra})});const res=await handle(request,room);return {status:res.status,body:await res.json()};};
 ok((await send('seat',2,null,{seat:3})).status,403);ok((await send('spectate',2)).status,200);
 ok((await send('seat',0,null,{seat:1})).status,200);ok((await send('seat',1,null,{seat:6})).status,200);
 const c0=(await send('connect',0)).body.result.connectionId,c1=(await send('connect',1)).body.result.connectionId;
 now=T;const hand=await owner.startHand(6);ok(hand.hand.players.length,2);ok(hand.hand.terms.bb,100);ok((await registry.advance(room)).event,'playing');
 ok((await send('state',0,c1)).status,409);ok((await send('state',0,c0)).body.result.youSeat,1);
 // Unpublishing cuts off public/new seating, not already admitted continuity.
 await db.exec('reset role');await db.query('update public.poker_tournaments set published=false where id=$1',[tid]);await db.exec('set role service_role');
 ok((await directory.assignments(users[0]))[0].published,false);ok((await directory.assignments(users[0]))[0].roomId,room);
 ok((await send('spectate',2)).status,403);ok(await can(users[0],'seat'),false);ok((await send('state',0,c0)).status,200);ok((await send('spectate',0)).status,200);
 const action={handId:hand.hand.handId,revision:hand.hand.revision,actionId:'fold',action:{type:'fold'}};ok((await send('act',1,c1,{command:action})).status,200);
 // Publication/structure edits do not change a bound room's frozen game terms at restart.
 await db.exec('reset role');const changed={...structure,startingStack:2000};await db.query('update public.poker_tournaments set structure=$2 where id=$1',[tid,JSON.stringify(changed)]);await db.exec('set role service_role');
 const reloaded=await new TournamentRoomRegistry(options).owner(room);ok((await reloaded.publicSnapshot()).hand.terms.bb,100);ok((await reloaded.publicSnapshot()).hand.players.reduce((n,p)=>n+p.stack,0),2000);
 // Disable all access with trusted maintenance; SQL role itself has no player-facing admin RPC.
 await db.exec('reset role');await db.query('update poker_private.tournament_rooms set enabled=false where room_id=$1',[room]);await db.exec('set role service_role');ok(await directory.assignments(users[0]),[]);ok(await can(users[0],'state'),false);ok(await can(users[0],'spectate'),false);ok(await registry.advance(room),null);
 // Removing a deleted Auth user also removes admission. No replacement/move is implied.
 await db.exec('reset role');await db.query('delete from auth.users where id=$1',[users[2]]);await db.exec('set role service_role');ok(await can(users[2],'state',room2),false);ok(await directory.assignments(users[2]),[]);const reduced=await directory.control(room2);ok(reduced.expectedCount,6);ok(reduced.members.length,5);for(let n=3;n<8;n++){await other.seat(users[n],n-2);await other.connect(users[n]);}const waiting=await registry.advance(room2);ok(waiting.event,'waiting');ok(waiting.readiness.ready,false);ok(waiting.state.hand,null);
 await db.exec('reset role');
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);for(const [name,params] of [['poker_room_assignments',[users[0]]],['poker_room_binding',[room]],['poker_room_control',[room]],['poker_room_tournament_config',[tid]],['poker_room_authorize',[room,users[0],'state']]]){await reject(db.query(`select public.${name}(${params.map((_,i)=>'$'+(i+1)).join(',')})`,params));}await reject(db.query('select public.poker_room_provision($1,$2,$3,2,false,$4,$5)',[room,tid,users.slice(0,2),new Date(T).toISOString(),JSON.stringify(structure)]));for(const table of ['tournament_rooms','room_admissions'])await reject(db.query('select * from poker_private.'+table));await db.exec('reset role');}
 ok((await db.query("select count(*)::int as n from pg_proc where proname in ('poker_room_binding','poker_room_tournament_config','poker_room_authorize','poker_room_provision','poker_room_control','poker_room_assignments') and prosecdef")).rows[0].n,0);
 ok((await db.query("select count(*)::int n from pg_indexes where indexname='room_admissions_member'")).rows[0].n,1);
 ok((await db.query("select proconfig from pg_proc where proname='poker_room_assignments'")).rows[0].proconfig,['search_path=\"\"']);
 await db.exec('grant usage on schema poker_private to authenticated;grant select on poker_private.tournament_rooms,poker_private.room_admissions to authenticated;set role authenticated');for(const table of ['tournament_rooms','room_admissions'])ok((await db.query('select * from poker_private.'+table)).rows,[]);await db.exec('reset role');
 console.log(`${checks} admission PostgreSQL checks passed (provision, roster isolation, visibility, HTTP dispatch, recovery, RLS).`);
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
