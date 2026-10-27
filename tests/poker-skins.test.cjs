const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,f);
const {TABLE_SKINS,CARD_SKINS,BACK_SKINS,tableSkin,cardSkin,backSkin,skinProps,skinUnlocked}=require('../lib/poker/skins.ts');
test('the standard skins add nothing, so the current design is drawn as it is',()=>{
 assert.equal(TABLE_SKINS[0].id,'standard');assert.equal(CARD_SKINS[0].id,'standard');
 assert.deepEqual(skinProps(tableSkin('standard'),cardSkin('standard')),{});
 assert.equal(tableSkin('no-such-skin').id,'standard','unknown ids fall back');
});
test('a non-standard skin sets the felt images, card colours per suit and the card back',()=>{
 const t={id:'velvet',name:'ベルベット',free:false,shopCode:'skin_table_velvet',desktop:'/images/skins/velvet/desktop.webp',mobile:'/images/skins/velvet/mobile.webp'};
 const c={id:'four',name:'4色',free:true,face:{background:'#fffdf5',border:'#ccc',spade:'#111',heart:'#c00',diamond:'#06c',club:'#080'}},k={id:'night',name:'夜',free:true,image:'/images/skins/night/back.svg'};
 const p=skinProps(t,c,k);assert.equal(skinProps(t,c)['data-card-back'],undefined,'standard back');
 assert.equal(p['data-table-skin'],'velvet');assert.equal(p['data-card-skin'],'four');assert.equal(p['data-card-back'],'image');
 assert.equal(p.style['--skin-table-desktop'],"url('/images/skins/velvet/desktop.webp')");assert.equal(p.style['--skin-card-d'],'#06c');assert.equal(p.style['--skin-card-c'],'#080');
 assert.equal(skinUnlocked(t,{},false),false);assert.equal(skinUnlocked(t,{skin_table_velvet:1},false),true);assert.equal(skinUnlocked(c,{},false),true);
 // 一旦すべて無料 (2026/10/27): every skin can be chosen without exchanging.
 assert.equal(skinUnlocked(t,{}),true);
});
test('every skin image in the registry exists',()=>{
 for(const s of TABLE_SKINS)for(const f of [s.desktop,s.mobile,s.thumb].filter(Boolean))assert.ok(fs.existsSync('public'+f),f);
 for(const s of CARD_SKINS)for(const f of [s.thumb].filter(Boolean))assert.ok(fs.existsSync('public'+f),f);
 for(const s of BACK_SKINS)for(const f of [s.image,s.thumb].filter(Boolean))assert.ok(fs.existsSync('public'+f),f);
});
test('every shop skin has an exchange item in the migration, and the registry has 4 tables, 3 faces, 4 backs',()=>{
 const {SKIN_SHOP_ITEMS}=require('../lib/poker/skins.ts');const sql=fs.readFileSync(require('node:path').join(__dirname,'../supabase/migrations',fs.readdirSync(require('node:path').join(__dirname,'../supabase/migrations')).find(f=>f.endsWith('_poker_skin_shop.sql'))),'utf8');
 for(const s of [...TABLE_SKINS,...CARD_SKINS,...BACK_SKINS].filter(s=>s.shopCode)){assert.match(sql,new RegExp(`'${s.shopCode}'`),s.shopCode);assert.ok(SKIN_SHOP_ITEMS.some(i=>i.code===s.shopCode));}
 assert.equal(TABLE_SKINS.length,4);assert.equal(CARD_SKINS.length,3);assert.equal(BACK_SKINS.length,4);
 const royal=cardSkin('royal');for(const r of [11,12,13])for(const su of ['s','h','d','c'])assert.ok(fs.existsSync('public'+royal.art[r][su]),`${r}${su}`);
});
