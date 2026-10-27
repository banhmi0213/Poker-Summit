const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,f);
const {TABLE_SKINS,CARD_SKINS,tableSkin,cardSkin,skinProps,skinUnlocked}=require('../lib/poker/skins.ts');
test('the standard skins add nothing, so the current design is drawn as it is',()=>{
 assert.equal(TABLE_SKINS[0].id,'standard');assert.equal(CARD_SKINS[0].id,'standard');
 assert.deepEqual(skinProps(tableSkin('standard'),cardSkin('standard')),{});
 assert.equal(tableSkin('no-such-skin').id,'standard','unknown ids fall back');
});
test('a non-standard skin sets the felt images, card colours per suit and the card back',()=>{
 const t={id:'velvet',name:'ベルベット',free:false,shopCode:'skin_table_velvet',desktop:'/images/skins/velvet/desktop.webp',mobile:'/images/skins/velvet/mobile.webp'};
 const c={id:'four',name:'4色',free:true,face:{background:'#fffdf5',border:'#ccc',spade:'#111',heart:'#c00',diamond:'#06c',club:'#080'},back:'/images/skins/four/back.svg'};
 const p=skinProps(t,c);
 assert.equal(p['data-table-skin'],'velvet');assert.equal(p['data-card-skin'],'four');assert.equal(p['data-card-back'],'image');
 assert.equal(p.style['--skin-table-desktop'],"url('/images/skins/velvet/desktop.webp')");assert.equal(p.style['--skin-card-d'],'#06c');assert.equal(p.style['--skin-card-c'],'#080');
 assert.equal(skinUnlocked(t,{}),false);assert.equal(skinUnlocked(t,{skin_table_velvet:1}),true);assert.equal(skinUnlocked(c,{}),true);
});
test('every skin image in the registry exists',()=>{
 for(const s of TABLE_SKINS)for(const f of [s.desktop,s.mobile,s.thumb].filter(Boolean))assert.ok(fs.existsSync('public'+f),f);
 for(const s of CARD_SKINS)for(const f of [s.back,s.thumb].filter(Boolean))assert.ok(fs.existsSync('public'+f),f);
});
