const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'..'),originalLoad=Module._load;
const dom=require('react-dom');dom.useFormState=()=>[{error:''},()=>{}];dom.useFormStatus=()=>({pending:false});
let saved=null,invalidations=[];
const id='11111111-1111-4111-8111-111111111111';
const base={user_id:id,full_name:'QA Dealer',age:25,pref:'大阪府',games:['テキサスホールデム'],experience_years:2,appeal:'',photo_url:null,avatar_kind:null,dealer_type:'フリーディーラー',published:true,available_dates:[],contract_status:'契約可能',available_regions:'大阪府・京都府',available_hours:'平日18:00〜翌2:00\n土日終日'};
const db={auth:{getUser:async()=>({data:{user:{id}}})},rpc:async(name,args)=>{if(name==='is_suspended')return {data:false};if(name==='get_dealer_reliability')return {data:[]};saved={name,args};return {error:null};},from(table){const query={select(){return query},eq(){return query},order(){return query},limit(){return query},maybeSingle(){return Promise.resolve(result())},then(resolve,reject){return Promise.resolve(result()).then(resolve,reject)}};function result(){if(table==='stores')return {data:{id,pref:'大阪府'}};if(table==='dealer_profiles')return {data:[base,{...base,user_id:'22222222-2222-4222-8222-222222222222',contract_status:'契約済み',available_regions:'',available_hours:''}]};throw Error(table)}return query}};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,file);
Module._load=function(request,parent,...rest){
 if(request==='next/link')return ({href,children,...props})=>React.createElement('a',{href,...props},children);
 if(request==='next/navigation')return {redirect(to){throw Error('REDIRECT:'+to)},notFound(){throw Error('NOT_FOUND')}};
 if(request==='next/cache')return {revalidatePath(p){invalidations.push(p)}};
 if(request==='server-only')return {};
 if(request.endsWith('.module.css'))return new Proxy({},{get:(_,k)=>k==='__esModule'?false:String(k)});
 if(request==='@/lib/supabase/server'||request==='@/lib/supabase/store-server')return {createClient:async()=>db,createStoreClient:async()=>db};
 if(request==='@/lib/matching-consent-server')return {requireMatchingConsent:async()=>{}};
 if(request==='@/app/matching/notice')return {MatchingRulesNotice:()=>null};
 if(request.startsWith('@/'))request=path.join(root,request.slice(2));
 return originalLoad.call(this,request,parent,...rest);
};
const {validDealerAvailability}=require('../lib/dealers.ts');
const {DealerForm}=require('../app/account/dealer/form.tsx');
const {DealerDetail}=require('../app/account/dealer/detail.tsx');
const {saveDealer}=require('../app/account/dealer/actions.ts');
(async()=>{
 for(const [type,status,regions,hours,expected] of [
 ['フリーディーラー','契約可能','大阪府','18:00〜24:00',true],
 ['フリーディーラー','契約済み','全国','土日終日',true],
 ['フリーディーラー','契約可能','','土日終日',false],
 ['フリーディーラー','契約可能','大阪府',' \n　',false],
 ['フリーディーラー','不正','大阪府','終日',false],
 ['フリーディーラー','契約可能','a'.repeat(301),'終日',false],
 ['ディーラー','契約可能','','',true]
 ])assert.equal(validDealerAvailability(type,status,regions,hours),expected);
 let html=renderToStaticMarkup(React.createElement(DealerForm,{profile:base,address:'QA',photo:null,today:'2026-10-09',contacts:null}));
 assert.match(html,/<input[^>]*name="availableRegions"[^>]*required/);
 assert.match(html,/<textarea[^>]*name="availableHours"[^>]*required/);
 html=renderToStaticMarkup(React.createElement(DealerForm,{profile:{...base,dealer_type:'ディーラー'},address:'QA',photo:null,today:'2026-10-09',contacts:null}));
 assert.doesNotMatch(html,/<input[^>]*name="availableRegions"[^>]*required/);
 assert.doesNotMatch(html,/<textarea[^>]*name="availableHours"[^>]*required/);
 html=renderToStaticMarkup(React.createElement(DealerDetail,{profile:{...base,contract_status:'契約済み',available_regions:'<script>bad</script>'},address:'QA',photo:null}));
 assert(html.includes('契約済み'));assert(html.includes('平日18:00〜翌2:00'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>bad'));
 const List=require('../app/store/(authenticated)/profile/dealers/page.tsx').default;
 html=renderToStaticMarkup(await List({searchParams:{}}));
 assert(html.includes('契約可能'));assert(html.includes('契約済み'));assert(html.includes('大阪府・京都府'));assert(html.includes('平日18:00〜翌2:00'));assert(html.includes('未記載'));
 const form=new FormData();for(const [k,v] of Object.entries({name:'QA',age:'25',pref:'大阪府',address:'QA',years:'2',dealerType:'フリーディーラー',contractStatus:'契約可能',games:'テキサスホールデム'}))form.set(k,v);
 let result=await saveDealer({error:''},form);assert(result.error.includes('必須'));assert.equal(saved,null);
 form.set('availableRegions','大阪府');result=await saveDealer({error:''},form);assert(result.error.includes('必須'));assert.equal(saved,null);
 form.set('availableHours',' \n　');result=await saveDealer({error:''},form);assert(result.error.includes('必須'));assert.equal(saved,null);
 // Successful save (no photo upload) uses the atomic RPC and refreshes the store list.
 db.from=()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:null,error:null})});
 form.set('availableHours',' 平日18:00〜翌2:00 ');form.set('contractStatus','契約済み');
 await assert.rejects(()=>saveDealer({error:''},form),/REDIRECT:\/account\/dealer\?done=1/);
 assert.equal(saved.name,'save_dealer_profile_with_availability');assert.equal(saved.args.p_contract_status,'契約済み');assert.equal(saved.args.p_regions,'大阪府');assert.equal(saved.args.p_hours,'平日18:00〜翌2:00');assert(invalidations.includes('/store/profile/dealers'));
 console.log('PASS: required fields, both status labels, list/detail rendering, missing-data fallback, XSS escaping, server validation, atomic save payload and revalidation');
})().catch(e=>{console.error(e);process.exit(1)});
