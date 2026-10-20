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
      './actions': { saveBlogEntry: () => { throw new Error('Must only save on explicit submit'); } },
    });
    const { draft } = parse(example());
    const html = renderToStaticMarkup(React.createElement(BlogEditor, { initialDraft: draft, stores: [], articles: [] }));
    assert.match(html, /name="id" value=""/);
    assert.ok(html.includes(draft.title)); assert.ok(html.includes(draft.seo_title)); assert.ok(html.includes(draft.meta_description));
    assert.ok(html.includes('受付で確認したい3つのこと')); assert.ok(html.includes('分からないことは着席前に聞く'));
    assert.match(html, /name="bodyImage_saved_5"/);
    assert.match(html, /option value="draft" selected=""/);
    assert.match(html, /name="image"[^>]*required=""/);
    assert.ok(!html.includes('https://api.openai.com'));
  } finally { global.fetch = oldFetch; }
});
