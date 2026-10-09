const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server'),root=path.resolve(__dirname,'..'),load=Module._load;
require('react-dom').useFormState=()=>[{error:''},()=>{}];require('react-dom').useFormStatus=()=>({pending:false});
let calls=[],invalidations=[];const id='11111111-1111-4111-8111-111111111111';
const db={auth:{getUser:async()=>({data:{user:{id}}})},rpc:async(name,args)=>{calls.push({name,args});return {data:null,error:null}}};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f);
Module._load=function(q,p,...rest){if(q==='server-only')return {};if(q.endsWith('.module.css'))return new Proxy({},{get:(_,k)=>k==='__esModule'?false:String(k)});if(q==='next/link')return ({href,children})=>React.createElement('a',{href},children);if(q==='next/navigation')return {redirect(to){throw Error('REDIRECT:'+to)}};if(q==='next/cache')return {revalidatePath(p){invalidations.push(p)}};if(q==='@/lib/supabase/server'||q==='@/lib/supabase/store-server')return {createClient:async()=>db,createStoreClient:async()=>db};if(q==='@/lib/matching-consent-server')return {requireMatchingConsent:async()=>{}};if(q==='@/lib/matching-notification-kick')return {kickMatchingNotifications:async()=>{throw Error('No notification for reviews')}};if(q.startsWith('@/'))q=path.join(root,q.slice(2));return load.call(this,q,p,...rest)};
const {submitWork}=require('../app/matching/work/actions.ts'),{WorkForm}=require('../app/matching/work/form.tsx'),{DealerReliabilityView}=require('../app/account/dealer/reliability.tsx'),{DealerReviews}=require('../app/account/dealer/reviews.tsx');
(async()=>{
 for(const actor of ['store','dealer']){
 const form=new FormData();Object.entries({actor,operation:'review',id,review:' 丁寧な対応でした。 '}).forEach(([k,v])=>form.set(k,v));
 for(const rating of ['', '0','6','2.5','NaN']){form.set('rating',rating);assert((await submitWork({error:''},form)).error);assert.equal(calls.length,0)}
 for(const rating of ['1','5']){form.set('rating',rating);await assert.rejects(()=>submitWork({error:''},form),/REDIRECT:/);const c=calls.pop();assert.equal(c.name,'update_spot_work_with_rating');assert.equal(c.args.p_actor,actor);assert.equal(c.args.p_rating,Number(rating));assert.equal(c.args.p_review,'丁寧な対応でした。')}
 const html=renderToStaticMarkup(React.createElement(WorkForm,{actor,operation:'review',id,rating:4}));assert.equal((html.match(/type="radio"/g)||[]).length,5);assert.match(html,/name="rating" required=""[^>]*checked="" value="4"/);
 form.set('operation','complete');await assert.rejects(()=>submitWork({error:''},form),/REDIRECT:/);assert.equal(calls.pop().name,'update_spot_work');
 }
 const stats={total:4,completed:3,cancellations:1,no_shows:0,average:4.5,rating_count:2,review_count:3,latest_review:{store_name:'QA店',review:'<script>bad</script>'}};
 let html=renderToStaticMarkup(React.createElement(DealerReliabilityView,{stats,compact:true}));assert(html.includes('75.0%'));assert(html.includes('25.0%'));assert(html.includes('4.5'));assert(html.includes('2件の評価'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>bad'));
 html=renderToStaticMarkup(React.createElement(DealerReliabilityView,{stats:{...stats,total:0,completed:0,cancellations:0,average:null,rating_count:0,review_count:0,latest_review:null}}));assert(html.includes('未集計'));assert(!html.includes('NaN'));assert(html.includes('星評価なし'));
 db.rpc=async(name,args)=>{assert.equal(name,'get_dealer_reviews');assert.equal(args.p_offset,10);return {data:{count:21,reviews:[{id,rating:null,review:'<b>レビュー</b>',store_name:'QA店',work_start:'2026-10-08T10:00:00Z'}]}}};
 html=renderToStaticMarkup(await DealerReviews({db,id,page:2,path:'/dealer'}));assert(html.includes('星評価なし'));assert(html.includes('&lt;b&gt;'));assert(html.includes('?reviews=1'));assert(html.includes('?reviews=3'));
 assert(invalidations.includes('/store/profile/dealers'));console.log('PASS: reciprocal required 1–5 ratings, atomic payload, completion compatibility, immediate invalidation, rates/zero history, escaped reviews and pagination');
})().catch(e=>{console.error(e);process.exitCode=1});
