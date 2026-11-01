const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const filename = path.join(root, file);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  const localRequire = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.endsWith('.css')) return {};
    if (name.startsWith('@/')) return load(name.slice(2) + '.ts', mocks);
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), name)) + '.ts', mocks);
    return require(name);
  };
  new Function('require', 'module', 'exports', compiled)(localRequire, mod, mod.exports);
  return mod.exports;
}
const { parseBlogImport, BLOG_IMPORT_EXAMPLE } = load('lib/blog-import.ts');
const example = () => JSON.parse(JSON.stringify(BLOG_IMPORT_EXAMPLE));
const parse = (data, articles = []) => parseBlogImport(JSON.stringify(data), articles);
test('imports article, SEO, H2/H3, list, table and manual image placeholders', () => {
  const { draft } = parse(example());
  assert.equal(draft.title, BLOG_IMPORT_EXAMPLE.title);
  assert.equal(draft.seo_title, BLOG_IMPORT_EXAMPLE.seoTitle);
  assert.equal(draft.meta_description, BLOG_IMPORT_EXAMPLE.metaDescription);
  assert.deepEqual(draft.body.map(b => b.type), ['paragraph', 'heading', 'list', 'heading3', 'paragraph', 'image', 'table']);
  assert.equal(draft.body[5].alt, '卓上に並んだポーカーチップ');
});
test('accepts code-fenced JSON and BOM', () => {
  assert.equal(parseBlogImport('\uFEFF```json\n' + JSON.stringify(example()) + '\n```').draft.slug, BLOG_IMPORT_EXAMPLE.slug);
});
test('untrusted IDs, publication settings and remote image paths never enter editor', () => {
  const input = { ...example(), id: 'existing-id', active: true, visibility: 'published', featured: true, publishedAt: '2026-10-20', canonicalUrl: 'https://other.test', image_url: 'https://other.test/image.png', image_path: 'existing.webp' };
  Object.assign(input.body[5], { url: 'https://other.test/image.png', path: 'existing.webp', uploadKey: 'other' });
  const d = parse(input).draft;
  assert.equal(d.id, undefined); assert.equal(d.active, false); assert.equal(d.visibility, 'draft'); assert.equal(d.featured, false);
  assert.equal(d.published_at, null); assert.equal(d.canonical_url, ''); assert.equal(d.image_url, ''); assert.equal(d.image_path, '');
  assert.deepEqual(d.body[5], { type: 'image', alt: input.body[5].alt, caption: input.body[5].caption });
});
test('matches only unique published related articles and explains skipped references', () => {
  const input = example(); input.relatedArticles = ['rules', 'id-2', '未登録', '同名', 'private'];
  const articles = [{ id: 'id-1', slug: 'rules', title: 'ルール', active: true }, { id: 'id-2', slug: 'terms', title: '用語', active: true }, { id: 'id-3', slug: 'a', title: '同名', active: true }, { id: 'id-4', slug: 'b', title: '同名', active: true }, { id: 'id-5', slug: 'private', title: '非公開', active: false }];
  const result = parse(input, articles);
  assert.deepEqual(result.draft.related_article_ids, ['id-1', 'id-2']); assert.equal(result.warnings.length, 3);
});
test('rejects duplicate slug, invalid structure, unsafe URLs and excessive text', () => {
  assert.throws(() => parse(example(), [{ id: 'a', slug: BLOG_IMPORT_EXAMPLE.slug, title: '既存', active: false }]), /登録済み/);
  for (const change of [
    d => d.version = 2, d => d.slug = '../admin', d => d.category = '不明', d => d.title = 'x'.repeat(161),
    d => d.body = [], d => d.body = [{ type: 'table', rows: [['a', 'b'], ['a']] }],
    d => d.body = [{ type: 'list', items: [123] }], d => d.showToc = 'true',
    d => d.references = [{ label: '出典', url: 'javascript:alert(1)' }],
    d => d.references = [{ label: '出典', url: 'https://secret@example.com' }],
  ]) { const data = example(); change(data); assert.throws(() => parse(data)); }
  assert.throws(() => parseBlogImport('{ broken'), /JSON/);
  assert.throws(() => parseBlogImport(' '.repeat(150001)), /15万/);
});
test('renders imported editor fields without any save or generation API call', () => {
  const oldFetch = global.fetch;
  global.fetch = () => { throw new Error('No network request is allowed during import'); };
  try {
    const { BlogEditor } = load('app/admin/blog/editor.tsx', {
      'react-dom': { useFormState: () => [{}, ""], useFormStatus: () => ({ pending: false }) },
      'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
      '@/app/blog/article-content': { ArticleContent: () => null },
      '@/app/blog/tournament-post': { TournamentPost: () => null },
      './actions': { saveBlogEntry: () => { throw new Error('Must only save on explicit submit'); } },
    });
    const { draft } = parse(example());
    const html = renderToStaticMarkup(React.createElement(BlogEditor, { initialDraft: draft, stores: [], articles: [] }));
    assert.match(html, /name="id" value=""/);
    assert.ok(html.includes(draft.title)); assert.ok(html.includes(draft.seo_title)); assert.ok(html.includes(draft.meta_description));
    assert.ok(html.includes('受付で確認したい3つのこと')); assert.ok(html.includes('分からないことは着席前に聞く'));
    assert.match(html, /name="bodyImage_saved_5"/);
    assert.match(html, /option value="draft" selected=""/);
    assert.ok(!/name="image"[^>]*required=""/.test(html));
    assert.ok(!html.includes('https://api.openai.com'));
  } finally { global.fetch = oldFetch; }
});

test('imports only validated X post URLs and strips tracking parameters', () => {
 const d = example(); d.xPostUrl = 'https://twitter.com/Poker_Summit/status/2111780849586991534?s=20';
 assert.equal(parse(d).draft.x_post_url, 'https://x.com/Poker_Summit/status/2111780849586991534');
 assert.equal(parse(example()).draft.x_post_url, '');
 for(const bad of ['https://evil.test/a/status/123','https://x.com/a','javascript:alert(1)','https://x.com.evil.test/a/status/123','https://u:p@x.com/a/status/123','<iframe src="https://x.com">']) {
  assert.throws(() => parse({...d,xPostUrl:bad}));
 }
});
test('heading links and X embeds survive import and reject unsafe URLs', () => {
 const data=example();data.body=[{type:'heading',text:'ニュース',sourceUrl:'https://example.com/news',sourceLabel:'公式発表',xPostUrl:'https://twitter.com/news/status/123?s=20'}];
 const result=parse(data).draft.body[0];
 assert.equal(result.sourceUrl,'https://example.com/news');assert.equal(result.sourceLabel,'公式発表');assert.equal(result.xPostUrl,'https://x.com/news/status/123');
 for(const fields of [{sourceUrl:'javascript:alert(1)'},{sourceUrl:'https://u:p@example.com/'},{xPostUrl:'https://evil.test/news/status/123'},{sourceLabel:'a'.repeat(201)}])assert.throws(()=>parse({...data,body:[{...data.body[0],...fields}]}));
 const legacy=parse({...data,body:[{type:'heading',text:'既存の見出し'}]}).draft.body[0];assert.equal(legacy.sourceUrl,'');assert.equal(legacy.xPostUrl,'');
});
test('renders per-heading source links and independent inline X posts', () => {
 const {ArticleContent}=load('app/blog/article-content.tsx', {
  '@/app/readable-name':{ReadableName:({name})=>name},
  '@/app/store-name-placeholder':{StoreNamePlaceholder:()=>null},
  './tournament-post':{TournamentPost:({url,inline})=>React.createElement('div',{'data-post':url,'data-inline':String(inline)})},
  './position-trainer':{PositionTrainer:()=>null},'./preflop-range-trainer':{PreflopRangeTrainer:()=>null},'./hand-strength-quiz':{HandStrengthQuiz:()=>null},'@/app/learn/pot-odds-trainer':{PotOddsTrainer:()=>null},'./bluff-simulator':{BluffSimulator:()=>null},
 });
 const body=[{type:'heading',text:'一つ目',sourceUrl:'https://example.com/a',sourceLabel:'公式発表',xPostUrl:'https://x.com/a/status/123'},{type:'heading3',text:'二つ目',sourceUrl:'javascript:alert(1)',xPostUrl:'https://x.com/b/status/456'}];
 const html=renderToStaticMarkup(React.createElement(ArticleContent,{title:'ニュース',category:'ポーカーニュース',summary:'',image:'',body,stores:[]}));
 assert.ok(html.includes('href="https://example.com/a"'));assert.ok(html.includes('公式発表'));assert.ok(!html.includes('javascript:'));assert.equal((html.match(/data-inline="true"/g)||[]).length,2);
});
