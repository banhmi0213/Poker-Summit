const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const filename = path.join(root, file);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  const localRequire = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('@/')) return load(name.slice(2) + '.ts', mocks);
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), name)) + '.ts', mocks);
    return require(name);
  };
  new Function('require', 'module', 'exports', source)(localRequire, mod, mod.exports);
  return mod.exports;
}
const { validateBlogDraft, parseEditorialSources } = load('lib/blog-ai.ts');
const publishedId = 'f34d66de-1aa1-421e-8736-f87fc6800c46';
function draft() {
  return {
    title: '初来店ガイド', slug: 'first-poker-room-guide', summary: '初来店に備える', seoTitle: 'ポーカー初来店ガイド', metaDescription: '受付とマナーを解説。',
    body: [{ type: 'paragraph', text: '初めての来店に向けて。' }, { type: 'heading', text: '料金を確認する' }, { type: 'list', items: ['参加費を確認', '講習を確認'] }],
    images: [{ prompt: 'A green poker table with face-down cards.', alt: '裏向きのカードを置いた緑の卓', afterBlock: -1 }, { prompt: 'Poker chips illustration', alt: '卓上のポーカーチップ', afterBlock: 1 }],
    relatedArticleIds: [publishedId],
  };
}
test('validates text, lists, related articles and planned images', () => {
  const result = validateBlogDraft(draft(), [publishedId], 2);
  assert.equal(result.body[1].type, 'heading');
  assert.equal(result.images.length, 2);
});
test('rejects invented related IDs, malformed tables, paths and oversized metadata', () => {
  for (const change of [
    d => d.relatedArticleIds.push('unknown'),
    d => d.body.push({ type: 'image', path: 'other-article.webp' }),
    d => d.body.push({ type: 'table', rows: [['a', 'b'], ['a']] }),
    d => d.metaDescription = 'x'.repeat(301),
    d => d.images[1].afterBlock = 999,
    d => d.slug = '../admin',
  ]) {
    const d = draft(); change(d);
    assert.throws(() => validateBlogDraft(d, [publishedId], 2));
  }
});
test('source URLs are validated and cannot carry credentials or executable schemes', () => {
  assert.equal(parseEditorialSources(JSON.stringify([{ label: '公式', url: 'https://example.com/event', excerpt: '10月20日確認' }])).length, 1);
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://secret@example.com']) {
    assert.throws(() => parseEditorialSources(JSON.stringify([{ label: '資料', url, excerpt: '内容' }])));
  }
});

function harness({ admin = true, user = true, lockError = null, providerError = false, news = false } = {}) {
  const calls = []; let saved;
  const supabase = {
    auth: { getUser: async () => ({ data: { user: user ? { id: 'admin' } : null } }) },
    rpc: async () => ({ data: admin }),
    from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: [{ id: publishedId, title: '基本ルール', active: true }] }) }) }) }),
    storage: { from: () => ({ upload: async (file, bytes, options) => { calls.push({ kind: 'lock', file, bytes, options }); return { error: lockError }; } }) },
  };
  const generator = load('app/admin/blog/ai-actions.ts', {
    '@/lib/supabase/server': { createClient: async () => supabase },
    '@/lib/audit': { logAdminAction: async () => {} },
    './actions': { saveBlogEntry: async (_, form) => { saved = form; return { id: publishedId }; } },
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({ audience: '初心者向け', category: news ? 'ポーカーニュース' : '初心者ガイド', topic: '', notes: '', extraImages: '1', sources: '[]', intent: 'publish', visibility: 'published' })) form.set(key, value);
  return { calls, form, saved: () => saved, run: () => generator.generateBlogDraft({}, form),
    fetch: async (url, options) => {
      const payload = JSON.parse(options.body); calls.push({ kind: 'api', url, payload });
      if (providerError && url.endsWith('images/generations')) return { ok: false, status: 429 };
      // Extra attacker-controlled fields must never affect publication or authorship.
      const d = { ...draft(), active: true, visibility: 'published', authorName: '架空の専門家' };
      return { ok: true, json: async () => url.endsWith('/responses')
        ? { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(d) }] }] }
        : { data: [{ b64_json: Buffer.from('RIFF0000WEBPtest').toString('base64') }] } };
    },
  };
}
test('server workflow: authentication, cost reservation, generation, draft-only save and failures', async t => {
  const oldFetch = global.fetch;
  const oldEnabled = process.env.BLOG_AI_ENABLED, oldKey = process.env.OPENAI_API_KEY;
  process.env.BLOG_AI_ENABLED = 'true'; process.env.OPENAI_API_KEY = 'test-only';
  try {
    await t.test('cannot publish even if form and model request it; maps images and SEO', async () => {
      const h = harness(); global.fetch = h.fetch;
      assert.equal((await h.run()).id, publishedId);
      const saved = h.saved();
      assert.equal(saved.get('intent'), 'draft'); assert.equal(saved.get('visibility'), 'draft');
      assert.equal(saved.get('authorName'), ''); assert.equal(saved.get('seoTitle'), draft().seoTitle);
      assert.equal(saved.get('image').type, 'image/webp');
      assert.equal(JSON.parse(saved.get('body')).filter(b => b.type === 'image').length, 1);
      assert.equal(saved.get('bodyImage_ai_0').type, 'image/webp');
      assert.equal(h.calls[0].kind, 'lock'); assert.equal(h.calls[0].options.upsert, false);
      assert.equal(h.calls[0].options.contentType, 'image/png');
      assert.equal(h.calls.filter(c => c.kind === 'api').length, 3);
    });
    for (const [label, options] of [['anonymous', { user: false }], ['non-admin', { admin: false }], ['reserved slot', { lockError: {} }], ['news without sources', { news: true }]]) {
      await t.test(`${label}: no paid calls and no save`, async () => {
        const h = harness(options); global.fetch = h.fetch;
        assert.ok((await h.run()).error);
        assert.equal(h.calls.filter(c => c.kind === 'api').length, 0); assert.equal(h.saved(), undefined);
      });
    }
    await t.test('image API failure never saves incomplete or published article', async () => {
      const h = harness({ providerError: true }); global.fetch = h.fetch;
      assert.match((await h.run()).error, /利用上限/); assert.equal(h.saved(), undefined);
    });
    await t.test('disabled feature never starts paid calls', async () => {
      process.env.BLOG_AI_ENABLED = 'false'; const h = harness(); global.fetch = h.fetch;
      assert.ok((await h.run()).error); assert.equal(h.calls.length, 0);
    });
  } finally {
    global.fetch = oldFetch;
    if (oldEnabled === undefined) delete process.env.BLOG_AI_ENABLED; else process.env.BLOG_AI_ENABLED = oldEnabled;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
  }
});
