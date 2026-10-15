const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, f);
const { validateStructure, defaultStructure, tournamentClock, lateRegistrationEndsAt, clockText } = require('../lib/poker/tournament.ts');
const start = '2026-10-16T10:00:00.000Z', t = Date.parse(start), copy = () => structuredClone(defaultStructure);
test('default structure validates and normalizes breaks without mutating input', () => {
    const s = copy(), snapshot = copy();
    assert.deepEqual(validateStructure(s), snapshot);
    assert.deepEqual(s, snapshot);
});
test('reject unsafe chip amounts, NaN, invalid ante mode and malformed periods', () => {
    for (const bad of [null, {}, { ...copy(), startingStack: 0 }, { ...copy(), startingStack: NaN }, { ...copy(), startingStack: Number.MAX_SAFE_INTEGER }, { ...copy(), anteType: 'cash' }, { ...copy(), reentry: 'yes' }, { ...copy(), periods: [] }])
        assert.throws(() => validateStructure(bad));
});
test('reject decreasing blinds and impossible SB BB values', () => {
    const s = copy();
    s.periods[1].bb = 1;
    assert.throws(() => validateStructure(s), /SB/);
    s.periods[1].bb = 90;
    assert.throws(() => validateStructure(s), /ブラインド/);
    s.periods[0].sb = -1;
    assert.throws(() => validateStructure(s));
});
test('reject invalid time, late registration, unknown kind and excessive notes', () => {
    for (const patch of [{ minutes: 0 }, { minutes: 1.5 }, { minutes: 241 }, { kind: 'mystery' }, { note: 'a'.repeat(201) }]) {
        const s = copy();
        Object.assign(s.periods[0], patch);
        assert.throws(() => validateStructure(s));
    }
    const s = copy();
    s.lateRegLevel = 9;
    assert.throws(() => validateStructure(s));
    s.lateRegLevel = 0;
    assert.doesNotThrow(() => validateStructure(s));
});
test('none ante means zero and BBA/per-player amounts may vary by level', () => {
    const s = copy();
    s.anteType = 'none';
    assert.throws(() => validateStructure(s), /アンティ/);
    s.periods.forEach(p => p.ante = 0);
    assert.doesNotThrow(() => validateStructure(s));
    s.anteType = 'per-player';
    s.periods[0].ante = 25;
    assert.equal(validateStructure(s).periods[0].ante, 25);
});
test('break cannot be the first or final scheduled period', () => {
    const s = copy();
    s.periods.push({ kind: 'break', minutes: 10, sb: 0, bb: 0, ante: 0, note: '' });
    assert.throws(() => validateStructure(s));
    s.periods.pop();
    s.periods.unshift(s.periods[4]);
    assert.throws(() => validateStructure(s));
});
test('clock has exact second countdown and level boundary behavior', () => {
    const s = copy();
    assert.equal(tournamentClock(s, start, t - 1).phase, 'scheduled');
    assert.equal(tournamentClock(s, start, t - 1).remaining, 1);
    let c = tournamentClock(s, start, t);
    assert.equal(c.level, 1);
    assert.equal(c.remaining, 1200);
    c = tournamentClock(s, start, t + 1200000 - 1);
    assert.equal(c.level, 1);
    assert.equal(c.remaining, 1);
    c = tournamentClock(s, start, t + 1200000);
    assert.equal(c.level, 2);
    assert.equal(c.period.sb, 75);
    assert.equal(c.remaining, 1200);
});
test('clock catches up after background tab or reload rather than counting ticks', () => {
    const c = tournamentClock(copy(), start, t + 65 * 60000);
    assert.equal(c.level, 4);
    assert.equal(c.remaining, 15 * 60);
    assert.equal(c.period.bb, 300);
});
test('break counts down, then resumes correct level and note', () => {
    let c = tournamentClock(copy(), start, t + 80 * 60000);
    assert.equal(c.phase, 'break');
    assert.equal(c.remaining, 600);
    assert.equal(c.next.bb, 400);
    assert.match(c.period.note, /カラーアップ/);
    c = tournamentClock(copy(), start, t + 90 * 60000);
    assert.equal(c.phase, 'level');
    assert.equal(c.level, 5);
    assert.equal(c.period.bb, 400);
});
test('late registration closes at end of specified playing level, excludes following break', () => {
    const s = copy();
    assert.equal(lateRegistrationEndsAt(s, start), t + 80 * 60000);
    assert.equal(tournamentClock(s, start, t + 80 * 60000 - 1).registrationOpen, true);
    assert.equal(tournamentClock(s, start, t + 80 * 60000).registrationOpen, false);
    s.lateRegLevel = 5;
    assert.equal(lateRegistrationEndsAt(s, start), t + 110 * 60000);
    s.lateRegLevel = 0;
    assert.equal(lateRegistrationEndsAt(s, start), t);
});
test('final configured level continues rather than ending a live tournament', () => {
    const c = tournamentClock(copy(), start, t + 999 * 60000);
    assert.equal(c.phase, 'final');
    assert.equal(c.period.bb, 1200);
    assert.equal(c.registrationOpen, false);
    assert.equal(c.next, null);
});
test('invalid clock dates fail and formatting never wraps minutes at 60', () => {
    assert.throws(() => tournamentClock(copy(), 'bad', t));
    assert.throws(() => tournamentClock(copy(), start, NaN));
    assert.equal(clockText(3601), '60:01');
    assert.equal(clockText(-1), '00:00');
});
