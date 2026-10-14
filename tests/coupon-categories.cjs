const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'..'),original=Module._load;
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
let saved=null,owned=true;
const query={select(){return this},eq(){return this},maybeSingle:async()=>({data:owned?{id:'store',banner_storage_path:null}:null}),insert:async payload=>{saved=payload;return {error:null}},update(payload){saved=payload;return this},then(resolve){resolve({error:null})}};
const db={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from:()=>query};
Module._load=function(name,parent,isMain){
 if(name==='@/lib/supabase/store-server')return {createStoreClient:async()=>db};
 if(name==='@/lib/store-banner-upload')return {uploadBannerImage:()=>{throw Error('unexpected upload')},removeBannerImage:()=>{throw Error('unexpected removal')}};
 if(name==='next/cache')return {revalidatePath:()=>{}};
 if(name==='next/link')return {__esModule:true,default:({children,href,...props})=>React.createElement('a',{href,...props},children)};
 if(name.endsWith('.css'))return {__esModule:true,default:new Proxy({},{get:(_,k)=>String(k)})};
 if(name.startsWith('@/'))name=path.join(root,name.slice(2));
 return original.call(this,name,parent,isMain);
};
const {COUPON_CATEGORIES,couponCategoryHref,matchesCouponLocation,requireCouponCategory}=require('../lib/coupon-categories.ts');
const {CouponCategoryEntrances}=require('../app/coupon-category-entrances.tsx');
const {CouponCategorySelect}=require('../app/coupon-category-select.tsx');
const {createCoupon,updateCoupon}=require('../app/store/(authenticated)/profile/coupons-actions.ts');
(async()=>{
 for(const c of COUPON_CATEGORIES){assert.equal(requireCouponCategory(c.value),c.value);}
 for(const v of ['', 'ドリンク特典','arbitrary'])assert.throws(()=>requireCouponCategory(v),/掲載カテゴリ/);
 const html=renderToStaticMarkup(React.createElement(CouponCategoryEntrances,{pref:'大阪府',area:'難波'}));
 assert.equal((html.match(/<a /g)||[]).length,3);
 for(const c of COUPON_CATEGORIES.slice(0,3))assert.ok(html.includes(c.label));
 const urls=[...html.matchAll(/href="([^"]+)"/g)].map(m=>new URL(m[1].replaceAll('&amp;','&'),'https://example.invalid'));
 assert.deepEqual(urls.map(u=>u.searchParams.get('offerType')),['参加費割引','ドリンク','初回来店']);
 assert.ok(urls.every(u=>u.pathname==='/coupons'&&u.searchParams.get('pref')==='大阪府'&&u.searchParams.get('area')==='難波'));
 assert.equal(new URL(couponCategoryHref('ドリンク','','','近畿'),'https://example.invalid').searchParams.get('region'),'近畿');
 const osaka={pref:'大阪府',city:'大阪市',address:'難波'};
 assert.ok(matchesCouponLocation(osaka,'大阪府','難波',''));
 assert.ok(!matchesCouponLocation(osaka,'東京都','',''));
 assert.ok(!matchesCouponLocation(osaka,'大阪府','梅田',''));
 assert.ok(matchesCouponLocation(osaka,'','','近畿'));
 assert.ok(!matchesCouponLocation(osaka,'','','関東'));
 assert.ok(!matchesCouponLocation(null,'大阪府','',''));
 const form=renderToStaticMarkup(React.createElement(CouponCategorySelect,{value:'ドリンク'}));
 assert.ok(/<select[^>]*required/.test(form));assert.ok(/value="ドリンク" selected/.test(form));assert.ok(form.includes('ドリンク特典'));assert.ok(form.includes('友達紹介'));assert.ok(!form.includes('任意'));
 for(const c of COUPON_CATEGORIES){
  const data=new FormData();data.set('storeId','store');data.set('couponId','coupon');data.set('title','QA');data.set('offerType',c.value);
  await createCoupon(data);assert.equal(saved.offer_type,c.value);
  await updateCoupon(data);assert.equal(saved.offer_type,c.value);
 }
 saved=null;const missing=new FormData();missing.set('storeId','store');missing.set('title','QA');
 await assert.rejects(()=>createCoupon(missing),/掲載カテゴリ/);assert.equal(saved,null);
 owned=false;missing.set('offerType','ドリンク');await assert.rejects(()=>createCoupon(missing),/権限/);assert.equal(saved,null);
 console.log('PASS: category links, region/pref/area, required management input, stored classification, legacy friend category, ownership guard; no external writes');
})().catch(e=>{console.error(e);process.exitCode=1});
