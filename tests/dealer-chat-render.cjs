// Server-rendering checks use synthetic data and never connect to Supabase.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),ts=require('typescript'),Module=require('module'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const reactDom=require('react-dom');reactDom.useFormState=()=>[{error:'',success:0},()=>{}];reactDom.useFormStatus=()=>({pending:false});
const root=path.resolve(__dirname,'..'),load=Module._load;
const uuid='11111111-1111-4111-8111-111111111111',store='22222222-2222-4222-8222-222222222222',dealer='33333333-3333-4333-8333-333333333333';
let state;
function db(){return {auth:{getUser:async()=>({data:{user:{id:state.actor==='store'?store:dealer,email:'qa@example.invalid'}}})},from(table){const q={select(){return q},eq(){return q},in(){return q},order(){return q},range(){return q},maybeSingle(){return Promise.resolve(result())},then(yes,no){return Promise.resolve(result()).then(yes,no)}};function result(){if(table==='stores')return {data:[{id:store}]};if(table==='dealer_matching_records')return {data:state.outsider?null:{id:uuid,store_id:store,dealer_user_id:dealer,work_start:'2099-10-15T09:00:00Z',work_end:'2099-10-15T14:00:00Z',status:state.confirmed?'confirmed':'pending',store_confirmed_at:state.confirmed?'2099-10-01':null,dealer_confirmed_at:state.confirmed?'2099-10-01':null,job_snapshot:{store_name:'Sample Store',dealer_name:'Sample Dealer',hourly_wage:1800,transport_type:'none',duties:'リング',games:['テキサスホールデム']}}};if(table==='dealer_chat_consents')return {data:state.consent?{accepted_at:'2099-10-01'}:null};if(table==='dealer_chat_messages')return {data:[{id:uuid,sender_id:dealer,body:'<script>alert(1)</script> 勤務を確認します',created_at:'2099-10-01T09:00:00Z'}],count:1};if(table==='dealer_chat_terms')return {data:state.terms?{revision:1,contract_type:'employment',payment_method:'bank',payment_date:'翌月15日',notes:'QA conditions'}:null};if(table==='dealer_chat_blocks')return {data:state.blocked?[{user_id:store}]:[]};throw Error('Unexpected query '+table)}return q},rpc:async()=>({data:[{phone:'090-0000-0000',contact_type:'email',contact_value:'contact@example.invalid'}]})};}
Module._extensions['.tsx']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,file);
Module._load=function(request,parent,...rest){
 if(request==='next/link')return function Link({href,children,...props}){return React.createElement('a',{href,...props},children)};
 if(request==='next/navigation')return {notFound(){throw Error('NOT_FOUND')},redirect(to){throw Error('REDIRECT:'+to)},useRouter:()=>({refresh(){}})};
 if(request.endsWith('.module.css'))return new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)});
 if(request==='@/lib/supabase/store-server')return {createStoreClient:async()=>db()};
 if(request==='@/lib/spot-jobs-server')return {dealerAccess:async()=>({db:db(),user:{id:dealer},allowed:!state.unregistered})};
 if(request==='@/lib/matching-consent-server')return {requireMatchingConsent:async()=>{}};
 if(request==='@/lib/spot-jobs')return {UUID:/^[0-9a-f-]{36}$/i};
 if(request==='@/app/portal-header')return {PortalHeader:()=>React.createElement('header',null,'Header')};
 if(request==='@/app/portal-footer')return {PortalFooter:()=>React.createElement('footer',null,'Footer')};
 if(request==='./actions'&&parent?.filename.endsWith('/chat/forms.tsx'))return {chatAction(){},offerAction(){}};
 return load.call(this,request,parent,...rest);
};
const {ChatRoom}=require(path.join(root,'app/matching/chat/page-content.tsx'));
(async()=>{
 async function render(options){state={actor:'store',consent:true,terms:true,...options};return renderToStaticMarkup(await ChatRoom({actor:state.actor,id:uuid}));}
 let html=await render({consent:false});assert(html.includes('同意してチャットを始める'));assert(!html.includes('勤務を確認します'));assert(!html.includes('090-0000'));
 html=await render({});assert(html.includes('条件を保存する'));assert(html.includes('勤務条件に合意する'));assert(!html.includes('contact@example.invalid'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>alert'));
 html=await render({actor:'dealer'});assert(!html.includes('条件を保存する'));assert(html.includes('勤務条件に合意する'));assert(html.includes('Header'));
 html=await render({confirmed:true});assert(html.includes('contact@example.invalid'));assert(!html.includes('勤務条件に合意する'));assert(!html.includes('条件を保存する'));
 html=await render({confirmed:true,blocked:true});assert(!html.includes('contact@example.invalid'));assert(!html.includes('メッセージを送信'));assert(html.includes('勤務の取消しにはなりません'));
 await assert.rejects(()=>render({outsider:true}),/NOT_FOUND/);
 await assert.rejects(()=>render({actor:'dealer',unregistered:true}),/REDIRECT:\/account\/dealer\/edit/);
 console.log('PASS: 7 chat render states, consent/contact gating, role controls, XSS escaping and access redirects');
})().catch(error=>{console.error(error);process.exit(1)});
