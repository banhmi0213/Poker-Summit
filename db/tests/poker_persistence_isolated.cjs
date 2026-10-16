// Disposable embedded PostgreSQL only; no production credentials/network.
const {PGlite}=require(process.env.POKER_PGLITE_MODULE||'@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID,randomBytes}=require('node:crypto'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {ScheduledTournamentRoom}=require('../../lib/poker/scheduled-tournament-room.ts'),{SupabaseRoomStore,prepareRoomSave,restoreRoom}=require('../../lib/poker/room-persistence.ts');
(async()=>{const db=new PGlite();let checks=0;const ok=(a,b)=>{assert.deepEqual(a,b);checks++;};
try {
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to anon,authenticated,service_role;');
 const migrations=path.resolve(__dirname,'../../supabase/migrations'),file=fs.readdirSync(migrations).find(f=>f.endsWith('_poker_room_checkpoints.sql'));await db.exec(fs.readFileSync(path.join(migrations,file),'utf8'));
 const rpc=async(name,args)=>{const map=name==='poker_room_load'?['p_room']:['p_room','p_expected','p_write','p_sealed','p_result'];try{const values=map.map(k=>typeof args[k]==='object'&&args[k]!==null?JSON.stringify(args[k]):args[k]);const q=await db.query(`select public.${name}(${values.map((_,i)=>'$'+(i+1)).join(',')}) as value`,values);return {data:Number.isNaN(Number(q.rows[0].value))||q.rows[0].value===null?q.rows[0].value:typeof q.rows[0].value==='object'?q.rows[0].value:Number(q.rows[0].value),error:null};}catch(error){return {data:null,error};}};
 await db.exec('set role service_role');const store=new SupabaseRoomStore({rpc}),id=randomUUID(),ring={active:'test',keys:{test:randomBytes(32)}},T=Date.parse('2026-10-16T10:00:00Z');
 const r=new ScheduledTournamentRoom({starts_at:new Date(T).toISOString(),structure:{startingStack:1000,anteType:'none',lateRegLevel:1,reentry:false,periods:[{kind:'level',minutes:1,sb:50,bb:100,ante:0,note:''}]}},{now:()=>T}),tokens={};for(const n of [1,6]){r.seat('m'+n,n);tokens[n]=r.connect('m'+n).connectionId;}r.startHand(6);
 ok(await store.load(id),null);const first=prepareRoomSave(id,0,r,ring);ok(await first.commit(store),1);ok(await first.commit(store),1);
 await assert.rejects(prepareRoomSave(id,0,r,ring).commit(store));checks++;
 const loaded=await restoreRoom(store,id,ring,{now:()=>T});ok(loaded.version,1);ok(loaded.room.publicSnapshot().hand,r.publicSnapshot().hand);ok(loaded.room.publicSnapshot().seats.every(s=>!s.connected),true);
 const s=r.publicSnapshot(),n=Number(s.hand.toAct.slice(5));r.act('m'+n,tokens[n],{handId:s.hand.handId,revision:s.hand.revision,actionId:'fold',action:{type:'fold'}});
 const terminal=prepareRoomSave(id,1,r,ring);ok(await terminal.commit(store),2);ok(await terminal.commit(store),2);
 ok((await db.query('select count(*)::int as n from poker_private.hand_results')).rows[0].n,1);
 const same=prepareRoomSave(id,2,r,ring);ok(await same.commit(store),3);ok((await db.query('select count(*)::int as n from poker_private.hand_results')).rows[0].n,1);
 const bad=prepareRoomSave(id,3,r,ring).request;bad.result.winners=['seat-99'];await assert.rejects(store.save(bad));checks++;ok((await store.load(id)).version,3);
 const wrong=structuredClone(same.request);wrong.sealed.data='modified';await assert.rejects(store.save(wrong));checks++;ok((await store.load(id)).version,3);
 const done=await restoreRoom(store,id,ring,{now:()=>T});ok(done.room.publicSnapshot().hand.result,r.publicSnapshot().hand.result);ok(done.room.publicSnapshot().tournament,r.publicSnapshot().tournament);
 const saved=JSON.stringify(await store.load(id));ok(saved.includes('m1'),false);ok(saved.includes(tokens[1]),false);
 await db.exec('reset role');ok((await db.query("select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='poker_private' and c.relrowsecurity")).rows[0].n,2);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);for(const query of ['select public.poker_room_load($1)','select * from poker_private.room_checkpoints where room_id=$1','select * from poker_private.hand_results where room_id=$1']){await assert.rejects(db.query(query,[id]));checks++;}await assert.rejects(db.query('select public.poker_room_save($1,0,$2,$3,null)',[id,randomUUID(),JSON.stringify(first.request.sealed)]));checks++;await db.exec('reset role');}
 // Even if table grants accidentally broaden, no permissive RLS policy exists.
 await db.exec('grant usage on schema poker_private to authenticated;grant select on poker_private.room_checkpoints,poker_private.hand_results to authenticated;set role authenticated');
 ok((await db.query('select * from poker_private.room_checkpoints')).rows,[]);ok((await db.query('select * from poker_private.hand_results')).rows,[]);await db.exec('reset role');
 ok((await db.query("select count(*)::int as n from pg_proc where proname in ('poker_room_load','poker_room_save') and prosecdef")).rows[0].n,0);
 console.log(`${checks} persistence PostgreSQL checks passed (CAS, retries, atomic logs, encrypted restore, backend-only permissions).`);
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
