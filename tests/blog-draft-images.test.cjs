const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, mocks) {
  const filename = path.join(root, file);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  const localRequire = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('@/')) return load(name.slice(2) + '.ts', mocks);
    return require(name);
  };
  new Function('require', 'module', 'exports', compiled)(localRequire, mod, mod.exports);
  return mod.exports;
}
const id = 'd69ce754-345a-46d5-a438-4021b93790ca';
function harness(previous) {
  let saved;
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'admin' } } }) },
    rpc: async () => ({ data: true }),
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: previous }) }) }),
      insert: values => { saved = values; return { select: () => ({ single: async () => ({ data: { id } }) }) }; },
      update: values => { saved = values; return { eq: () => ({ select: () => ({ single: async () => ({ data: { id } }) }) }) }; },
    }),
    storage: { from: () => ({ remove: async () => ({}) }) },
  };
  const { saveBlogEntry } = load('app/admin/blog/actions.ts', {
    '@/lib/supabase/server': { createClient: async () => supabase },
    '@/lib/revalidate': { revalidatePath: () => {} },
    '@/lib/audit': { logAdminAction: async () => {} },
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({ title: '画像なし下書き', slug: 'draft-without-image', category: '初心者ガイド', contentMode: 'internal', intent: 'draft', visibility: 'draft', body: JSON.stringify([{ type: 'paragraph', text: '本文' }, { type: 'image', alt: '後から登録する写真のALT', caption: '写真の説明', uploadKey: 'pending_1' }]) })) form.set(key, value);
  if (previous) form.set('id', id);
  return { form, run: () => saveBlogEntry({}, form), saved: () => saved };
}
test('new draft can be saved without cover or body images; image placeholders survive', async () => {
  const h = harness();
  assert.equal((await h.run()).id, id);
  assert.equal(h.saved().image_url, ''); assert.equal(h.saved().image_path, ''); assert.equal(h.saved().active, false);
  assert.deepEqual(h.saved().body[1], { type: 'image', alt: '後から登録する写真のALT', caption: '写真の説明', uploadKey: 'pending_1' });
});
test('image-free saved draft can be reopened and saved again', async () => {
  const h = harness({ image_url: '', image_path: '', body: [], published_at: null });
  assert.equal((await h.run()).id, id); assert.equal(h.saved().visibility, 'draft');
});
test('publication still requires a cover image', async () => {
  const h = harness(); h.form.set('intent', 'publish'); h.form.set('visibility', 'published');
  assert.match((await h.run()).error, /公開するにはメイン画像/); assert.equal(h.saved(), undefined);
});
test('publication with a cover still rejects unfilled body image placeholders', async () => {
  const h = harness({ image_url: 'https://example.com/saved.webp', image_path: 'saved.webp', body: [], published_at: null });
  h.form.set('intent', 'publish');
  assert.match((await h.run()).error, /本文の写真/); assert.equal(h.saved(), undefined);
});
test('existing cover is retained when saving without selecting another image', async () => {
  const h = harness({ image_url: 'https://example.com/saved.webp', image_path: 'saved.webp', body: [], published_at: null });
  assert.equal((await h.run()).id, id); assert.equal(h.saved().image_path, 'saved.webp');
});
test('X post can be saved, cleared, and invalid URLs never reach persistence', async () => {
 const h = harness(); h.form.set('xPostUrl','https://twitter.com/Poker_Summit/status/2111780849586991534?s=20');
 assert.equal((await h.run()).id,id); assert.equal(h.saved().x_post_url,'https://x.com/Poker_Summit/status/2111780849586991534');
 h.form.set('xPostUrl',''); await h.run(); assert.equal(h.saved().x_post_url,'');
 const bad = harness();bad.form.set('xPostUrl','https://example.com/post/123');
 assert.match((await bad.run()).error,/形式/);assert.equal(bad.saved(),undefined);
});
test('heading URLs persist on save and unsafe heading links are rejected', async () => {
 const h=harness();h.form.set('body',JSON.stringify([{type:'heading',text:'見出し',sourceUrl:'https://example.com/news',sourceLabel:'発表',xPostUrl:'https://twitter.com/news/status/123?s=20'}]));
 assert.equal((await h.run()).id,id);assert.equal(h.saved().body[0].xPostUrl,'https://x.com/news/status/123');assert.equal(h.saved().body[0].sourceLabel,'発表');
 const bad=harness();bad.form.set('body',JSON.stringify([{type:'heading',text:'見出し',sourceUrl:'javascript:alert(1)'}]));assert.ok((await bad.run()).error);assert.equal(bad.saved(),undefined);
});
