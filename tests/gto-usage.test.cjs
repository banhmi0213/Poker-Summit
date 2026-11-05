const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,stubs={}){const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(name=>name in stubs?stubs[name]:require(name),mod,mod.exports);return mod.exports;}
const usage=load('lib/gto-usage.ts'),environment=load('lib/gto-usage-environment.ts');
const event=(time,visitor='v1',tool='preflop',action='open',member=null,device='pc')=>({created_at:time,visitor_id:visitor,tool,action,member_id:member,device});
test('JST boundaries include midnight, exclude next midnight, and compare previous day',()=>{
 const p=usage.usagePeriod('daily','2026-11-05');assert.equal(new Date(p.start).toISOString(),'2026-11-04T15:00:00.000Z');
 const r=usage.usageReport([event('2026-11-04T14:59:59Z'),event('2026-11-04T15:00:00Z'),event('2026-11-05T14:59:59Z','v2'),event('2026-11-05T15:00:00Z','v3')],p);
 assert.equal(r.total.pv,2);assert.equal(r.previous.pv,1);assert.equal(r.trend.length,30);
});
test('monthly boundaries, leap February and year changes',()=>{
 const p=usage.usagePeriod('monthly','2024-02');assert.equal((p.end-p.start)/86400000,29);assert.equal(new Date(p.end).toISOString(),'2024-02-29T15:00:00.000Z');assert.equal(p.buckets.length,12);
 const jan=usage.usagePeriod('monthly','2027-01');assert.equal(usage.jstDay(jan.previous),'2026-12-01');
});
test('invalid dates fall back to a valid day; prototype properties are not tool IDs',()=>{
 assert.notEqual(usage.usagePeriod('daily','2026-02-30').value,'2026-02-30');assert.notEqual(usage.usagePeriod('monthly','2026-99').value,'2026-99');assert.equal(usage.isTool('__proto__'),false);assert.equal(usage.isAction('delete'),false);
});
test('UU is deduplicated across tools; member counts use member IDs, not browsers; answers are separate from PV',()=>{
 const r=usage.usageReport([event('2026-11-05T00:00:00Z','v1','preflop','open','m1'),event('2026-11-05T00:00:01Z','v1','flop','open','m1'),event('2026-11-05T00:00:02Z','v2','quiz','answer','m1','mobile'),event('2026-11-05T00:00:03Z','v3','quiz','start')],usage.usagePeriod('daily','2026-11-05'));
 assert.equal(r.total.uu,3);assert.equal(r.total.members,1);assert.equal(r.total.pv,2);assert.equal(r.total.answers,1);assert.equal(r.total.starts,1);assert.equal(r.tools.find(t=>t.tool==='quiz').uu,2);assert.equal(r.total.mobile,1);
});
test('CSV contains UTF8 BOM, all ten tools + global dedup row, and handles zero comparison',()=>{
 const p=usage.usagePeriod('daily','2026-11-05'),r=usage.usageReport([],p),csv=usage.usageCsv(r,p);assert.ok(csv.startsWith('\uFEFF'));assert.equal(csv.split('\r\n').length,12);assert.match(csv,/GTO全体/);assert.deepEqual(usage.usageDelta(5,0),{change:5,percent:null});assert.deepEqual(usage.usageDelta(5,10),{change:-5,percent:-50});
});
const UUID='00000000-0000-4000-8000-000000000001';
function recorder(options={}){
 const rows=new Map(),writes=[];
 const {POST}=load('app/api/gto-usage/route.ts',{
  'next/server':require('next/server'),'@/lib/gto-usage-environment':environment,'@/lib/gto-usage':usage,
  '@/lib/device':{isBotUserAgent:ua=>!ua||/bot/.test(ua),classifyDevice:ua=>/mobile/.test(ua)?'mobile':'pc'},
  '@/lib/visitor':{getVisitorId:()=>options.visitor===false?null:UUID},
  '@/lib/supabase/server':{createClient:async()=>({rpc:async()=>({data:!!options.admin,error:options.authFailure?'error':null}),auth:{getUser:async()=>({data:{user:options.user??null},error:null})}})},
  '@/lib/supabase/service-role':{createServiceRoleClient:()=>({from:name=>({upsert:async(row,opts)=>{assert.equal(name,'gto_usage_events');if(options.dbFailure)throw Error('missing table');writes.push(row);assert.equal(opts.ignoreDuplicates,true);if(!rows.has(row.id))rows.set(row.id,row);}})})},
 });
 const request=(body={event_id:UUID,tool:'quiz',action:'answer'},cookies=[])=>({headers:new Headers({'user-agent':options.ua??'Mozilla mobile',origin:options.origin??'https://staging.example'}),nextUrl:new URL('https://staging.example/api/gto-usage'),cookies:{get:n=>cookies.find(c=>c.name===n),getAll:()=>cookies},json:async()=>body});
 return {POST,request,rows,writes};
}
test('anonymous operation is one row, no personal fields; duplicate event ID stays one row',async()=>{
 const r=recorder();assert.equal((await r.POST(r.request())).status,204);await r.POST(r.request());assert.equal(r.rows.size,1);const row=[...r.rows.values()][0];assert.equal(row.member_id,null);assert.equal(row.device,'mobile');assert.deepEqual(Object.keys(row).sort(),['action','device','id','member_id','tool','visitor_id']);
});
test('member ID is verified server-side, never trusted from body',async()=>{
 const r=recorder({user:{id:'verified-member'}});await r.POST(r.request({event_id:UUID,tool:'quiz',action:'open',member_id:'forged'},[{name:'sb-test',value:'x'}]));assert.equal([...r.rows.values()][0].member_id,'verified-member');
});
test('bot, staff, admin, cross-origin, invalid enum and missing visitor are excluded',async()=>{
 for(const opts of [{ua:'searchbot'},{admin:true},{authFailure:true},{origin:'https://evil.test'},{visitor:false}]){const r=recorder(opts);await r.POST(r.request(undefined,[{name:'sb-test',value:'x'}]));assert.equal(r.rows.size,0,JSON.stringify(opts));}
 const r=recorder();await r.POST(r.request(undefined,[{name:'ps_staff',value:'1'}]));await r.POST(r.request({event_id:UUID,tool:'__proto__',action:'open'}));assert.equal(r.rows.size,0);
});
test('missing table or network failure returns 204 without blocking the UI',async()=>{const r=recorder({dbFailure:true});assert.equal((await r.POST(r.request())).status,204);});
test('admin authorization rejects guests and normal members',async()=>{
 for(const [user,admin,expected] of [[null,false,false],[{id:'m'},false,false],[{id:'a'},true,true]]){
  const server=load('lib/gto-usage-server.ts',{'server-only':{},'./gto-usage-environment':environment,'./gto-usage':usage,'@/lib/supabase/service-role':{},'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:admin?{user_id:'a'}:null,error:null})})})})})}});assert.equal(await server.isUsageAdmin(),expected);
 }
});
test('the existing analytics page has zero changes and the new menu follows it',()=>{
 assert.equal(require('crypto').createHash('sha256').update(fs.readFileSync('app/admin/analytics/page.tsx')).digest('hex'),'e9681d1a31cef63e783c05c3ac56a4f4fcf096affb60f877104297e0b66e259d');
 assert.match(fs.readFileSync('app/admin/admin-sidebar.tsx','utf8'),/href: "\/admin\/analytics"[^\n]*\n\s*\{ href: "\/admin\/gto-usage"/);
});
test('dashboard loads beyond 1,000 rows and returns only aggregate data',async()=>{
 const rows=Array.from({length:1037},(_,i)=>({...event('2026-11-05T00:00:00Z','v'+i),id:String(i).padStart(5,'0')}));let pages=0;
 const svc={from:()=>{let selection='',after='';const q={select:s=>{selection=s;return q},order:()=>q,limit:()=>q,gte:()=>q,lt:()=>q,gt:(_,v)=>{after=v;return q},maybeSingle:async()=>({data:{created_at:rows[0].created_at},error:null}),then:(resolve,reject)=>{pages++;return Promise.resolve({data:rows.filter(r=>r.id>after).slice(0,1000),error:null}).then(resolve,reject)}};return q;}};
 const server=load('lib/gto-usage-server.ts',{'server-only':{},'./gto-usage-environment':environment,'./gto-usage':usage,'@/lib/supabase/server':{},'@/lib/supabase/service-role':{createServiceRoleClient:()=>svc}});
 const out=await server.loadUsage(usage.usagePeriod('daily','2026-11-05'));assert.equal(out.report.total.pv,1037);assert.equal(out.report.total.uu,1037);assert.equal(pages,2);assert.equal(JSON.stringify(out).includes('visitor_id'),false);
});
test('CSV route denies unauthorized users before querying usage records',async()=>{
 let queried=false;const route=load('app/admin/gto-usage/csv/route.ts',{'next/server':require('next/server'),'@/lib/gto-usage-environment':environment,'@/lib/gto-usage':usage,'@/lib/gto-usage-server':{isUsageAdmin:async()=>false,loadUsage:async()=>{queried=true;throw Error('must not query')}}});assert.equal((await route.GET({nextUrl:new URL('https://test/admin/gto-usage/csv')})).status,403);assert.equal(queried,false);
});

test('Preview can only record/read the separate staging DB, never inherited production DB',()=>{
 assert.equal(environment.gtoUsageDatabaseReady({VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:'https://mjdgylgzhsygcgtuceow.supabase.co'}),true);
 assert.equal(environment.gtoUsageDatabaseReady({VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:'https://tjmeqnzvuoguoffltxrp.supabase.co'}),false);
 assert.equal(environment.gtoUsageDatabaseReady({VERCEL_ENV:'preview'}),false);
 assert.equal(environment.gtoUsageDatabaseReady({VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://tjmeqnzvuoguoffltxrp.supabase.co'}),true);
});

test('withdrawal retains the production function body and only anonymizes GTO usage after practice cleanup',()=>{
 const old=fs.readFileSync('supabase/migrations/20261101110000_withdraw_member_poker.sql','utf8');
 const next=fs.readFileSync('supabase/migrations/20261105021924_withdraw_member_gto_usage.sql','utf8');
 const body=s=>s.split('as $function$')[1].split('$function$;')[0];
 const addition="  if to_regclass('public.gto_usage_events') is not null then\n    execute 'update public.gto_usage_events set member_id = null where member_id = $1' using p_uid;\n  end if;\n";
 assert.equal(body(next).split(addition).length,2);
 assert.equal(body(next).replace(addition,''),body(old));
 assert.ok(body(next).includes("    execute 'delete from public.poker_gto_practice_hands where member_id = $1' using p_uid;\n  end if;\n"+addition));
 assert.match(next,/revoke all on function private\.withdraw_member\(uuid\) from public,anon,authenticated;/);
});
