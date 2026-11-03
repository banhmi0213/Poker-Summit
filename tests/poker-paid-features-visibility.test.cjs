// Paid features switch (owner 2026/11/01 04:00): default off; while off, equipped placeholder looks render as 標準.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),ts=require('typescript'),Module=require('module');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const resolve=Module._resolveFilename;Module._resolveFilename=function(r,...a){return resolve.call(this,r.startsWith('@/')?path.join(__dirname,'..',r.slice(2))+'.ts':r,...a);};
const fresh=env=>{for(const k of Object.keys(require.cache))if(/lib[\\/](cosmetics|billing[\\/]visibility)\.ts$/.test(k))delete require.cache[k];
 if(env===undefined)delete process.env.NEXT_PUBLIC_PAID_FEATURES;else process.env.NEXT_PUBLIC_PAID_FEATURES=env;
 return {...require('../lib/billing/visibility.ts'),...require('../lib/cosmetics.ts')};};
test('default off: nothing paid is visible and equipped placeholders render as 標準',()=>{
 for(const env of [undefined,'','off','1','true']){const c=fresh(env);
  assert.equal(c.paidFeaturesVisible(),false,String(env));
  assert.equal(c.frameStyle('frame_gold'),undefined);assert.equal(c.plateStyle('plate_gold'),undefined);
  assert.deepEqual(c.threadStyle('thread_gold'),{});assert.equal(c.threadCardStyle('thread_gold'),undefined);
  assert.equal(c.frameItem('frame_gold').id,'standard');}
});
test('NEXT_PUBLIC_PAID_FEATURES=on (staging testers) shows them again',()=>{
 const c=fresh('on');assert.equal(c.paidFeaturesVisible(),true);
 assert.equal(c.frameItem('frame_gold').id,'gold');assert.ok(c.plateStyle('plate_gold'));assert.ok(c.threadCardStyle('thread_gold'));
 fresh(undefined);
});
test('pages: /pricing is noindex/nofollow and unlinked while off; the plan and looks panes are filtered',()=>{
 const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
 assert.match(read('app/pricing/page.tsx'),/robots:\{index:false,follow:false\}/);
 assert.doesNotMatch(read('app/sitemap.ts'),/`\$\{base\}\/pricing/);
 assert.match(read('app/mypage/poker/page.tsx'),/paidFeaturesVisible\(\)\?tourneyShown:tourneyShown\.filter\(p=>!\['plan','looks'\]/);
 for(const f of ['app/terms/page.tsx','app/tokushoho/page.tsx'])assert.match(read(f),/paidFeaturesVisible\(\)\?<a href="\/pricing">/);
});
