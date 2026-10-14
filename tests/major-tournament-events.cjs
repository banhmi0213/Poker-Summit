const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file);
const { tournamentGeography, toDomesticTournamentEvent, matchesEventLocation, matchesEventDate, getDomesticTournamentEvents } = require('../lib/major-tournament-events.ts');
const now = '2026-10-14T03:00:00Z';
const base = { id: 'qa-major', title: 'QA Main', scope: '国内', active: true, location: '大阪府大阪市', venue: 'なんばヒップス 5F DIJEST', description: '', start_date: '2026-10-15', end_date: '2026-10-18' };
const venues = [
  ['大阪府', 'なんばヒップス 5F DIJEST', '近畿', '難波'],
  ['大阪府', '難波御堂筋ホール b2 hall・6F', '近畿', '難波'],
  ['大阪府', '歌留多', '近畿', '心斎橋'],
  ['大阪府', '堂島リバーフォーラム', '近畿', 'その他大阪'],
  ['東京都渋谷区', 'EBiS303', '関東', '恵比寿'],
  ['東京都', 'ベルサール新宿グランド', '関東', '新宿'],
  ['東京都', 'ベルサール高田馬場（新宿区）', '関東', '新宿'],
  ['愛知県名古屋市', '中日ビル 中日ホール', '中部', '栄・錦'],
  ['愛知県名古屋市', 'レジェンドホール名古屋', '中部', 'その他愛知'],
  ['福岡県', 'UNITEDLAB（福岡市）', '九州・沖縄', '天神・大名'],
  ['鹿児島県鹿児島市', 'ライカ南国ホール', '九州・沖縄', '鹿児島中央'],
  ['広島県', 'NTTクレドホール（広島市）', '中国', '八丁堀・紙屋町'],
  ['宮城県仙台市', '秋保リゾート ホテルクレセント', '北海道・東北', 'その他宮城'],
  ['富山県中新川郡上市町', 'つるぎふれあい館 2階 コミュニティプラザ', '中部', 'その他富山'],
];
for (const [location, venue, region, area] of venues) {
  const event = toDomesticTournamentEvent({ ...base, location, venue }, now);
  assert(matchesEventLocation(event, { region, pref: event.pref, area }));
  assert(!matchesEventLocation(event, { region: region === '関東' ? '近畿' : '関東' }));
  assert(!matchesEventLocation(event, { area: '存在しないエリア' }));
}
const unknown = toDomesticTournamentEvent({ ...base, location: '滋賀県', venue: '' }, now);
assert(matchesEventLocation(unknown, { region: '近畿', pref: '滋賀県' }));
assert(!matchesEventLocation(unknown, { area: '大津' }));
assert(!matchesEventLocation(unknown, { area: 'その他滋賀' }));
assert.equal(tournamentGeography({ location: '東京都', venue: '大阪DIJEST' }).areas.length, 0);
assert.deepEqual(tournamentGeography({ location: '三重県四日市', venue: '会場' }).regions, ['近畿', '中部']);
const event = toDomesticTournamentEvent(base, now);
assert.equal(event.href, '/major-tournaments/qa-major');
assert.equal(event.start_at, '2026-10-14T15:00:00.000Z');
assert.equal(event.end_at, '2026-10-18T14:59:59.999Z');
for (const day of ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']) assert(matchesEventDate(event, day));
assert(!matchesEventDate(event, '2026-10-19'));
assert(!matchesEventDate(event, '2026-10-14'));
assert(toDomesticTournamentEvent(base, '2026-10-18T14:59:59.999Z'));
assert.equal(toDomesticTournamentEvent(base, '2026-10-18T15:00:00.000Z'), null);
for (const patch of [{ scope: '海外' }, { active: false }, { start_date: null }, { end_date: '2026-10-13' }]) assert.equal(toDomesticTournamentEvent({ ...base, ...patch }, now), null);
const ordinary = { start_at: '2026-10-15T18:00:00Z', location: '大阪 難波', stores: { pref: '大阪府', city: '大阪市' } };
assert(matchesEventLocation(ordinary, { pref: '大阪府', area: '難波' }));
assert(matchesEventDate(ordinary, '2026-10-16'));
assert(!matchesEventDate(ordinary, '2026-10-15'));
(async () => {
  const filters = [];
  const query = { select() { return this; }, eq(k, v) { filters.push([k, v]); return this; }, order() { return Promise.resolve({ data: [base, { ...base, id: 'foreign', scope: '海外' }, { ...base, id: 'past', end_date: '2026-10-13' }], error: null }); } };
  const events = await getDomesticTournamentEvents({ from: () => query }, now);
  assert.equal(events.length, 1);
  assert.deepEqual(filters, [['scope', '国内'], ['active', true]]);
  // Render the actual listing to verify links, date-only presentation and
  // combined filters, rather than checking only the adapter in isolation.
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const originalLoad = Module._load;
  const festival = { ...base, title: 'QA国内大型大会' };
  const db = { auth: { getUser: async () => ({ data: { user: null } }) }, from(table) {
    const query = { select() { return this; }, eq() { return this; }, order() { return this; }, then(resolve) {
      return Promise.resolve({ data: table === 'major_tournaments' ? [festival, { ...festival, scope: '海外', title: 'QA海外大会' }] : [{ id: 'store-event', title: 'QA店舗トーナメント', category: 'トーナメント', start_at: '2026-11-01T09:00:00Z', end_at: null, location: '大阪府難波', stores: { name: 'QA店舗', pref: '大阪府', city: '難波' } }], error: null }).then(resolve);
    } }; return query;
  } };
  Module._load = function(name, parent, isMain) {
    if (name === '@/lib/supabase/server') return { createClient: async () => db };
    if (name === 'next/link') return { __esModule: true, default: ({ children, href, ...props }) => React.createElement('a', { ...props, href }, children) };
    if (name === 'next/image') return { __esModule: true, default: ({ priority, ...props }) => React.createElement('img', props) };
    if (['@/app/portal-header', '@/app/portal-footer', '@/app/bottom-tabs', '@/app/compact-portal-banner'].includes(name)) return new Proxy({}, { get: () => () => null });
    if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (name.startsWith('@/')) name = path.join(root, name.slice(2));
    return originalLoad.call(this, name, parent, isMain);
  };
  const RealDate = Date;
  global.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return new RealDate(now).getTime(); } };
  const Page = require('../app/events/page.tsx').default;
  const html = renderToStaticMarkup(await Page({ searchParams: { region: '近畿', pref: '大阪府', area: '難波', date: '2026-10-17', kind: 'トーナメント' } }));
  assert(html.includes('/major-tournaments/qa-major'));
  assert(!html.includes('/events/major-qa-major'));
  assert(!html.includes('QA海外大会'));
  assert(!html.includes('QA店舗トーナメント'));
  assert(!html.includes('00:00'));
  assert(html.includes('〜10/18'));
  const excluded = renderToStaticMarkup(await Page({ searchParams: { region: '関東' } }));
  assert(!excluded.includes('QA国内大型大会'));
  const ordinaryHtml = renderToStaticMarkup(await Page({ searchParams: { q: 'QA店舗' } }));
  assert(ordinaryHtml.includes('/events/store-event'));
  assert(ordinaryHtml.includes('18:00'));
  global.Date = RealDate;
  Module._load = originalLoad;
  console.log('PASS: venue/prefecture/region/area matching, unknown venue, cross-region exclusion, all festival days, JST expiry, foreign/inactive exclusion and ordinary-event compatibility');
})().catch(e => { console.error(e); process.exitCode = 1; });
