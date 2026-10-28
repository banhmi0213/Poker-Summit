// Render the real component against engine states without a browser or database.
const { createRequire, Module } = require('module'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), req = createRequire(root + '/package.json'), ts = req('typescript'), assert = require('assert/strict');
const old = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...args) { if (name.startsWith('@/'))
    name = root + '/' + name.slice(2); try {
    return old.call(this, name, parent, ...args);
}
catch (e) {
    for (const x of ['.ts', '.tsx'])
        try {
            return old.call(this, name + x, parent, ...args);
        }
        catch { }
    throw e;
} };
for (const ext of ['.ts', '.tsx'])
    require.extensions[ext] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, f);
require.extensions['.css'] = (m) => m.exports = { __esModule: true, default: new Proxy({}, { get: (o, k) => k }) };
const React = req('react'), { renderToStaticMarkup } = req('react-dom/server'), Component = req(root + '/app/poker-demo/poker-table-preview.tsx').default, { createBettingRound, applyBettingAction } = req(root + '/lib/poker/betting.ts');
const original = React.useState;
let fixture;
const stateForFixture = function (initial) { return original(typeof initial === 'function' ? () => { const value = initial(); return value?.players && value?.bigBlind ? fixture : value; } : initial); };
const deck = req(root + '/lib/poker/engine.ts').createDeck();
const fixtureDeal = { board: deck.slice(12,17), holes: Object.fromEntries(['you','p5','p3','p2','p4','p6'].map((id,i)=>[id,[deck[i],deck[i+6]]])) };
function render(r,extra = {}) { fixture = r; let html; React.useState = stateForFixture; try {
    html = renderToStaticMarkup(React.createElement(Component, { member: { displayName: 'TEST', avatarUrl: null }, initialDeal: fixtureDeal, isGuestPreview: true, ...extra }));
}
finally {
    React.useState = original;
} const block = html.match(/<div class="actions">([\s\S]*?)<\/div>/)[1]; const buttons = [...block.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map(m => ({ disabled: m[1].includes('disabled'), text: m[2] })); return { html, buttons }; }
require('node:test').test('controls render legal amounts and actions across five betting states', () => {
    let r = createBettingRound([{ id: 'you', stack: 1000, committed: 50 }, { id: 'p5', stack: 1000, committed: 100 }, { id: 'p3', stack: 1000 }, { id: 'p2', stack: 1000 }, { id: 'p4', stack: 1000 }, { id: 'p6', stack: 1000 }], 100, 'you');
    let v = render(r);
    assert.deepEqual(v.buttons.map(b => b.disabled), [false, false, false]);
    assert.match(v.buttons[1].text, /50/);
    assert.match(v.html, /min="200" max="1050" step="1"/);
    r = createBettingRound([{ id: 'you', stack: 30, committed: 50 }, { id: 'p5', stack: 1000, committed: 100 }, { id: 'p3', stack: 0, folded: true }, { id: 'p2', stack: 0, folded: true }, { id: 'p4', stack: 0, folded: true }, { id: 'p6', stack: 0, folded: true }], 100, 'you');
    v = render(r);
    assert.deepEqual(v.buttons.map(b => b.disabled), [false, false, true]);
    assert.match(v.buttons[1].text, /オールインコール.*30/);
    r = createBettingRound([{ id: 'you', stack: 1000 }, { id: 'p5', stack: 1000 }, { id: 'p3', stack: 1000 }, { id: 'p2', stack: 1000 }, { id: 'p4', stack: 1000 }, { id: 'p6', stack: 1000 }], 100, 'you');
    v = render(r);
    assert.deepEqual(v.buttons.map(b => b.disabled), [false, false, false]);
    assert.equal(v.buttons[2].text, 'ベット');
    assert.match(v.html, /min="100" max="1000"/);
    r = applyBettingAction(r, 'you', { type: 'check' });
    v = render(r);
    assert.ok(v.buttons.every(b => b.disabled));
    r = createBettingRound([{ id: 'you', stack: 150 }, { id: 'p5', stack: 1000 }, { id: 'p3', stack: 1000 }, { id: 'p2', stack: 1000 }, { id: 'p4', stack: 1000 }, { id: 'p6', stack: 1000 }], 100, 'p5');
    r = applyBettingAction(r, 'p5', { type: 'bet', amount: 100 });
    for (const id of ['p3', 'p2', 'p4', 'p6'])
        r = applyBettingAction(r, id, { type: 'call' });
    v = render(r);
    assert.equal(v.buttons[2].text, 'オールイン');
    assert.match(v.html, /min="150" max="150"/);
    assert.match(v.html, /オールインのみ/);
    React.useState = original;
});

require('node:test').test('blind chip markers show posted amounts and clear on the next street', () => {
    const { postBlinds } = req(root + '/lib/poker/settlement.ts');
    const { beginNextBettingStreet, potTotal } = req(root + '/lib/poker/betting.ts');
    const ids = ['you', 'p5', 'p3', 'p2', 'p4', 'p6'];
    const posted = postBlinds(ids.map(id => ({ id, stack: 1000 })), 5, 50, 100);
    let r = createBettingRound(posted.players, 100, posted.positions.preflopFirst);
    let view = render(r);
    assert.match(view.html, /aria-label="あなた：SB ベット 50"/);
    assert.match(view.html, /aria-label="PLAYER 5：BB ベット 100"/);
    assert.equal((view.html.match(/class="betChip"/g) || []).length, 2);
    assert.equal(potTotal(r), 150); // Markers are a view of existing chips, not extra contributions.
    for (const id of ['p3', 'p2', 'p4', 'p6', 'you']) r = applyBettingAction(r, id, { type: 'call' });
    r = applyBettingAction(r, 'p5', { type: 'check' });
    view = render(r);
    assert.equal((view.html.match(/class="betChip"/g) || []).length, 6);
    r = beginNextBettingStreet(r, 'you');
    assert.equal(potTotal(r), 600);
    assert.doesNotMatch(render(r).html, /class="betChip"/);
});

require('node:test').test('preflop renders the supplied hand, ten opponent card backs and no board', () => {
    const ids = ['you', 'p5', 'p3', 'p2', 'p4', 'p6'];
    const r = createBettingRound(ids.map(id => ({ id, stack: 1000 })), 100, 'you');
    const html = render(r).html;
    const { cardLabel } = req(root + '/lib/poker/card-display.ts');
    const hand = html.match(/<div class="hole"[^>]*>([\s\S]*?)<\/div>/)[1];
    for (const card of fixtureDeal.holes.you) assert.ok(hand.replace(/<[^>]+>/g,'').includes(cardLabel(card)));
    assert.equal((html.match(/class="cardBack"/g) || []).length, 10);
    assert.equal((html.match(/src="\/images\/summit-finger-clean.webp"(?! alt="" data-summit)/g)||[]).length,10,'ten card backs (the Summit button beside your avatar is not a card)');
    assert.match(html, /aria-label="共通カード"[^>]*><\/div>/);
});

require('node:test').test('tournament sample renders top clock, structure menu and scope notice',()=>{
 const {defaultStructure}=req(root+'/lib/poker/tournament.ts');
 const ids=['you','p5','p3','p2','p4','p6'],r=createBettingRound(ids.map(id=>({id,stack:1000})),100,'you');
 const tournament={id:'sample',title:'TEST CUP',owner_store_id:null,starts_at:'2026-10-16T10:00:00Z',published:false,structure:defaultStructure,image_url:null};
 const html=render(r,{tournament,serverNow:Date.parse(tournament.starts_at)}).html;
 assert.match(html,/トーナメント・ブラインドタイマー/);assert.match(html,/LEVEL 1/);assert.match(html,/20:00/);assert.match(html,/>テーブル情報<\/button>/);assert.match(html,/大会設定連動デモ/);
});
require('node:test').test('structure table renders all levels, break and late registration details',()=>{
 const {defaultStructure}=req(root+'/lib/poker/tournament.ts');
 const View=req(root+'/app/poker-tournaments/structure-view.tsx').default;
 const html=renderToStaticMarkup(React.createElement(View,{structure:defaultStructure,currentIndex:4}));
 assert.match(html,/10,000/);assert.match(html,/BBアンティ/);assert.match(html,/レベル4終了まで/);assert.match(html,/25点チップのカラーアップ/);assert.equal((html.match(/<tr/g)||[]).length,10);assert.match(html,/aria-current="step"/);
});
require('node:test').test('saved tournament renders faint background image, collaboration and typed prizes',()=>{
 const {defaultStructure}=req(root+'/lib/poker/tournament.ts');
 const Panel=req(root+'/app/poker-tournaments/clock-panel.tsx').default;
 const tournament={id:'test',title:'COLLAB CUP',owner_store_id:null,starts_at:'2026-10-16T10:00:00Z',published:true,structure:defaultStructure,image_url:'https://example.com/logo.png',organizer_name:'Summit × コラボ',prizes:[{rank:1,kind:'chips',chips:5000,description:''},{rank:2,kind:'text',chips:0,description:'ギフト券'}]};
 const props={tournament,serverNow:Date.parse(tournament.starts_at)};
 for(const mode of ['clock','structure']) { const html=renderToStaticMarkup(React.createElement(Panel,{...props,mode}));assert.match(html,/src="https:\/\/example.com\/logo.png"/);assert.match(html,/class="backdrop"/);assert.match(html,/Summit × コラボ/);if(mode==='structure'){assert.match(html,/5,000 チップ/);assert.match(html,/ギフト券/);assert.match(html,/自動付与は準備中/);} }
});
require('node:test').test('numeric controls change chips by ten, minutes by one, preserve 75 and clamp limits',()=>{
 const Stepper=req(root+'/app/poker-tournaments/number-stepper.tsx').default;
 const oldId=React.useId;React.useId=()=> 'stepper';
 try{
  let changed;
  let el=Stepper({label:'SB',value:75,onChange:v=>changed=v,min:0,max:100});
  const [minus,input,plus]=el.props.children;
  minus.props.onClick();assert.equal(changed,65);plus.props.onClick();assert.equal(changed,85);
  assert.equal(input.props.step,1);assert.equal(input.props.inputMode,'numeric');assert.equal(minus.props.type,'button');assert.equal(plus.props.type,'button');
  let prevented=false;input.props.onKeyDown({key:'ArrowUp',preventDefault:()=>prevented=true});assert.equal(changed,85);assert.ok(prevented);
  el=Stepper({label:'分',value:20,onChange:v=>changed=v,min:1,max:240,increment:1});el.props.children[2].props.onClick();assert.equal(changed,21);el.props.children[0].props.onClick();assert.equal(changed,19);
  el=Stepper({label:'SB',value:95,onChange:v=>changed=v,min:0,max:100});el.props.children[2].props.onClick();assert.equal(changed,100);
  el=Stepper({label:'分',value:1,onChange:v=>changed=v,min:1,max:240,increment:1});assert.equal(el.props.children[0].props.disabled,true);
  el=Stepper({label:'休憩SB',value:0,onChange:v=>changed=v,disabled:true});assert.ok(el.props.children.every(child=>child.props.disabled));
 }finally{React.useId=oldId;}
});
require('node:test').test('structure editor exposes mobile steppers with correct field increments',()=>{
 const Editor=req(root+'/app/poker-tournaments/structure-editor.tsx').default;
 const html=renderToStaticMarkup(React.createElement(Editor));
 assert.match(html,/行1 sbを10増やす/);assert.match(html,/行1 minutesを1増やす/);assert.match(html,/レイトレジスト終了レベルを1増やす/);assert.match(html,/data-label="SB"/);assert.match(html,/data-label="分"/);
 assert.match(html,/aria-label="行2 sb"[^>]*value="75"/);
});
require('node:test').test('real tournament initial render applies starting stack, blind level and BBA',()=>{
 const {defaultStructure}=req(root+'/lib/poker/tournament.ts');
 const structure={...structuredClone(defaultStructure),startingStack:20000};structure.periods[0]={...structure.periods[0],sb:200,bb:400,ante:400};structure.periods=structure.periods.slice(0,1);structure.lateRegLevel=1;
 const tournament={id:'sample',title:'LIVE SETTINGS',owner_store_id:null,starts_at:'2026-10-16T10:00:00Z',published:false,structure,image_url:null};
 const html=renderToStaticMarkup(React.createElement(Component,{member:{displayName:'TEST',avatarUrl:null},initialDeal:fixtureDeal,tournament,serverNow:Date.parse(tournament.starts_at)}));
 assert.match(html,/SB 200 \/ BB 400/);assert.match(html,/19,800/);assert.doesNotMatch(html,/19,800 chips/);assert.match(html,/PLAYER 5<\/span><small>19,200/);assert.match(html,/ポット <strong>1,000/);assert.match(html,/アンティ合計：400/);assert.match(html,/BBアンティ・BB優先/);assert.doesNotMatch(html,/50\/100・アンティなし/);
});
require('node:test').test('scheduled and break pages keep full stacks, no forced pot, no cards and disabled actions',()=>{
 const {defaultStructure}=req(root+'/lib/poker/tournament.ts');
 const tournament={id:'sample',title:'WAIT',owner_store_id:null,starts_at:'2026-10-16T10:00:00Z',published:false,structure:defaultStructure,image_url:null};
 for(const offset of [-1,80*60000]){
  const html=renderToStaticMarkup(React.createElement(Component,{member:{displayName:'TEST',avatarUrl:null},initialDeal:fixtureDeal,tournament,serverNow:Date.parse(tournament.starts_at)+offset}));
  assert.match(html,/未開始（強制ベット未徴収）/);assert.match(html,/10,000/);assert.match(html,/ポット <strong>0/);assert.doesNotMatch(html,/class="hole"/);assert.doesNotMatch(html,/class="cardBack"/);assert.match(html,/<button class="reset" type="button" disabled="">大会デモを開始/);
 }
});
require('node:test').test('heads-up render combines BTN/SB, deals only two live hands and marks unused seats empty',()=>{
 const {defaultStructure}=req(root+'/lib/poker/tournament.ts');
 const tournament={id:'sample',title:'HU',owner_store_id:null,starts_at:'2026-10-16T10:00:00Z',published:false,structure:defaultStructure,image_url:null};
 const {dealDemoHandAtTable}=req(root+'/lib/poker/demo-deal.ts');
 const initialDeal=dealDemoHandAtTable(['you','p5','p3','p2','p4','p6'],['you','p2'],'you');
 const html=renderToStaticMarkup(React.createElement(Component,{member:{displayName:'TEST',avatarUrl:null},initialDeal,tournament,initialSeatIds:['you','p2'],serverNow:Date.parse(tournament.starts_at)}));
 assert.match(html,/残り 2人 ／ 開始 2人・ヘッズアップ/);assert.match(html,/aria-label="[^"]*SB ベット/,'SB is kept for screen readers');assert.doesNotMatch(html,/<b>SB <\/b>/,'no SB label on the chip');assert.doesNotMatch(html,/positionBadge/,'no position badge on players');assert.match(html,/aria-label="ディーラーボタン"/);assert.doesNotMatch(html,/>BTN/);assert.equal((html.match(/class="cardBack"/g)||[]).length,2);assert.equal((html.match(/class="eliminatedTag">空席/g)||[]).length,4);assert.match(html,/ポット <strong>150/);assert.doesNotMatch(html,/相手のフォールド確認/);
});
require('node:test').test('when your seat is outside the current hand, cards and action controls stay inactive',()=>{
 const {defaultStructure}=req(root+'/lib/poker/tournament.ts');const {dealDemoHandAtTable}=req(root+'/lib/poker/demo-deal.ts');
 const tournament={id:'sample',title:'FOLLOW',owner_store_id:null,starts_at:'2026-10-16T10:00:00Z',published:false,structure:defaultStructure,image_url:null},ids=['p2','p4'];
 const html=renderToStaticMarkup(React.createElement(Component,{member:{displayName:'TEST',avatarUrl:null},initialDeal:dealDemoHandAtTable(['you','p5','p3','p2','p4','p6'],ids,'p2'),tournament,initialSeatIds:ids,serverNow:Date.parse(tournament.starts_at)}));
 assert.doesNotMatch(html,/class="hole"/);assert.match(html,/脱落・進行確認中/);
 const block=html.match(/<div class="actions">([\s\S]*?)<\/div>/)[1];assert.equal((block.match(/disabled=""/g)||[]).length,3);
 assert.match(html,/<button class="reset" type="button">デモをリセット<\/button>/);
});
