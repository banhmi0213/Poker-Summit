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
function render(r) { fixture = r; let html; React.useState = stateForFixture; try {
    html = renderToStaticMarkup(React.createElement(Component, { member: { displayName: 'TEST', avatarUrl: null }, isGuestPreview: true }));
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
