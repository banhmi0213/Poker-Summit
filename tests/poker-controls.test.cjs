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
    assert.deepEqual(v.buttons.map(b => b.disabled), [false, true, false, false]);
    assert.match(v.buttons[2].text, /50/);
    assert.match(v.html, /min="200" max="1050" step="1"/);
    r = createBettingRound([{ id: 'you', stack: 30, committed: 50 }, { id: 'p5', stack: 1000, committed: 100 }, { id: 'p3', stack: 0, folded: true }, { id: 'p2', stack: 0, folded: true }, { id: 'p4', stack: 0, folded: true }, { id: 'p6', stack: 0, folded: true }], 100, 'you');
    v = render(r);
    assert.deepEqual(v.buttons.map(b => b.disabled), [false, true, false, true]);
    assert.match(v.buttons[2].text, /オールインコール.*30/);
    r = createBettingRound([{ id: 'you', stack: 1000 }, { id: 'p5', stack: 1000 }, { id: 'p3', stack: 1000 }, { id: 'p2', stack: 1000 }, { id: 'p4', stack: 1000 }, { id: 'p6', stack: 1000 }], 100, 'you');
    v = render(r);
    assert.deepEqual(v.buttons.map(b => b.disabled), [false, false, true, false]);
    assert.equal(v.buttons[3].text, 'ベット');
    assert.match(v.html, /min="100" max="1000"/);
    r = applyBettingAction(r, 'you', { type: 'check' });
    v = render(r);
    assert.ok(v.buttons.every(b => b.disabled));
    r = createBettingRound([{ id: 'you', stack: 150 }, { id: 'p5', stack: 1000 }, { id: 'p3', stack: 1000 }, { id: 'p2', stack: 1000 }, { id: 'p4', stack: 1000 }, { id: 'p6', stack: 1000 }], 100, 'p5');
    r = applyBettingAction(r, 'p5', { type: 'bet', amount: 100 });
    for (const id of ['p3', 'p2', 'p4', 'p6'])
        r = applyBettingAction(r, id, { type: 'call' });
    v = render(r);
    assert.equal(v.buttons[3].text, 'オールイン');
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
    assert.match(view.html, /aria-label="あなた：SB ベット 50 chips"/);
    assert.match(view.html, /aria-label="PLAYER 5：BB ベット 100 chips"/);
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
    const hand = html.match(/<div class="hole">([\s\S]*?)<\/div>/)[1];
    for (const card of fixtureDeal.holes.you) assert.ok(hand.includes(cardLabel(card)));
    assert.equal((html.match(/class="cardBack"/g) || []).length, 10);
    assert.match(html, /aria-label="共通カード"><\/div>/);
});

require('node:test').test('tournament sample renders top clock, structure menu and scope notice',()=>{
 const {defaultStructure}=req(root+'/lib/poker/tournament.ts');
 const ids=['you','p5','p3','p2','p4','p6'],r=createBettingRound(ids.map(id=>({id,stack:1000})),100,'you');
 const tournament={id:'sample',title:'TEST CUP',owner_store_id:null,starts_at:'2026-10-16T10:00:00Z',published:false,structure:defaultStructure,image_url:null};
 const html=render(r,{tournament,serverNow:Date.parse(tournament.starts_at)}).html;
 assert.match(html,/トーナメント・ブラインドタイマー/);assert.match(html,/LEVEL 1/);assert.match(html,/20:00/);assert.match(html,/>ストラクチャー<\/button>/);assert.match(html,/50\/100・アンティなし/);
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
