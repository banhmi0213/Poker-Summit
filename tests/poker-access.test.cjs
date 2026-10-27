const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,f);
const {pokerAccess}=require('../lib/poker/access.ts');
test('poker is for members with a confirmed e-mail only',()=>{
 assert.equal(pokerAccess(null),'login');
 assert.equal(pokerAccess({email_confirmed_at:null}),'verify');
 assert.equal(pokerAccess({email_confirmed_at:'2026-10-27T00:00:00Z',is_anonymous:true}),'verify');
 assert.equal(pokerAccess({email_confirmed_at:'2026-10-27T00:00:00Z'}),'ok');
 for(const f of ['app/poker-lobby/page.tsx','app/poker-demo/page.tsx','app/poker-ring/[tableId]/page.tsx'])assert.match(fs.readFileSync(f,'utf8'),/pokerAccess\(user\)/,f);
});
