const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'..');
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
const {getPublicStoreRankings,getFavoriteStoreIds}=require('../lib/public-store-rankings.ts');
let mode='missing',favoriteMode='missing',signedIn=true;const row={id:'qa-store',name:'QAランキング店舗',pref:'東京都',city:'新宿区'};
const db={auth:{getUser:async()=>({data:{user:signedIn?{id:'member',email:'fixture@example.test'}:null}})},rpc:async(name,args)=>{assert.equal(name,'public_store_rankings');if(mode==='reject')throw new Error('network');return mode==='ok'?{data:[row],error:null}:{data:[row],error:{code:'42883'}};},from(table){return {select(){return this;},eq(){return this;},in(){return this;},order(){return this;},then(resolve,reject){if(table==='favorite_stores'){if(favoriteMode==='reject')return Promise.reject(new Error('network')).then(resolve,reject);return Promise.resolve(favoriteMode==='ok'?{data:[{store_id:row.id}],error:null}:{data:null,error:{code:'42P01'}}).then(resolve,reject);}return Promise.resolve({data:[],error:null}).then(resolve,reject);}};}};
const originalLoad=Module._load;
const component=({children})=>React.createElement(React.Fragment,null,children);
const components=new Proxy({__esModule:true,default:component},{get:(o,key)=>key in o?o[key]:component});
const home={now:'2026-11-03T00:00:00Z',announcement:null,pickupPool:[],latestJobs:[],latestPosts:[],displayEvents:[],popularCoupons:[],topBannerRows:[],pickupBannerRows:[],couponBannerRows:[],communityBannerRows:[],rankingBannerRows:[],jobsBannerRows:[],footerThreeBannerRows:[],replyCounts:{}};
Module._load=function(name,parent,isMain){
 if(name==='@/lib/supabase/server')return {createClient:async()=>db};
 if(name==='next/link')return {__esModule:true,default:({children,href})=>React.createElement('a',{href},children)};
 if(name==='next/headers')return {headers:()=>({get:()=>''})};
 if(name==='@/lib/home-data')return {getHomePublicData:async()=>home};
 if(name==='@/lib/current-pref')return {getCurrentPref:async()=>({pref:null,source:'none'})};
 if(name==='@/lib/store-card-extras')return {getStoreCardExtras:async()=>({coverPhotos:new Map(),flags:new Map(),counts:new Map()})};
 if(name==='@/lib/pref-counts')return {getPrefStoreCounts:async()=>({})};
 if(name==='@/lib/contracts')return {assemblePickup:rows=>rows};
 if(name==='@/lib/prelaunch')return {freerollSignupOpen:()=>false};
 if(name==='@/lib/store-list-data')return {getStoreListData:async()=>({stores:[row],storeListBanner:[null,null],prefCities:[]}),getStoreCountForArea:async()=>1,getAreaStats:async()=>null};
 if(name==='@/lib/store-content-counts')return {getStoreContentCounts:async()=>new Map()};
 if(name==='@/lib/plan-entitlements')return {sortByListPriority:rows=>rows};
 if(name==='@/lib/banners')return {bannersForDevice:rows=>rows,isExternalBannerLink:()=>false};
 if(name.endsWith('home-store-card')||name.endsWith('store-list-card'))return {HomeStoreCard:({store,isFavorite})=>React.createElement('article',{'data-favorite':isFavorite},store.name),StoreListCard:({store})=>React.createElement('article',null,store.name)};
 if(name.endsWith('home-ranking-banner'))return {HomeRankingBanner:()=>React.createElement('aside',null,'QAランキングバナー')};
 if(name.endsWith('.css'))return {__esModule:true,default:new Proxy({},{get:(_,k)=>String(k)})};
 if(name.startsWith('@/app/')||(parent?.filename.startsWith(path.join(root,'app'))&&name.startsWith('./')))return components;
 if(name.startsWith('@/'))name=path.join(root,name.slice(2));
 return originalLoad.call(this,name,parent,isMain);
};
(async()=>{
 const pages=[require('../app/page.tsx').default,require('../app/stores/page.tsx').default,require('../app/stores/ranking/page.tsx').default];
 for(const failure of ['missing','reject']){mode=failure;favoriteMode=failure;
  assert.deepEqual(await getPublicStoreRankings(db),{data:[],available:false});assert.equal((await getFavoriteStoreIds(db,'member')).size,0);
  for(let i=0;i<pages.length;i++){const html=renderToStaticMarkup(await pages[i]({searchParams:{pref:'東京都'}}));assert(!html.includes('店舗ランキング'));assert(!html.includes('QAランキングバナー'));if(i===0)assert(html.includes('求人'));if(i===1)assert(html.includes(row.name));assert(html.includes('TOP')||html.includes('サイト')||html.includes('店舗'));}
 }
 mode='ok';favoriteMode='ok';
 assert.equal((await getPublicStoreRankings(db)).data[0],row);assert.deepEqual([...(await getFavoriteStoreIds(db,'member'))],[row.id]);
 for(const Page of pages){const html=renderToStaticMarkup(await Page({searchParams:{pref:'東京都'}}));assert(html.includes('店舗ランキング'));assert(html.includes(row.name));assert(html.includes('data-favorite="true"'));}
 mode='ok';favoriteMode='missing';for(const Page of pages){const html=renderToStaticMarkup(await Page({searchParams:{pref:'東京都'}}));assert(html.includes('店舗ランキング'));assert(html.includes('data-favorite="false"'));}
 signedIn=false;assert.equal((await getFavoriteStoreIds(db,undefined)).size,0);
 const manifest=require('../app/manifest.ts').default();assert.equal(manifest.start_url,'/mypage/poker');assert.equal(manifest.id,'/');assert.equal(manifest.scope,'/');
 console.log('PASS: all three real pages render with missing RPC/table and rejected reads; successful rankings/favorites remain visible; favorites failure leaves rankings intact; GTO start_url and app identity verified');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{Module._load=originalLoad;});
