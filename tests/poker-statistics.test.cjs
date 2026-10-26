const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {statisticsCSV}=require('../lib/poker/statistics-csv.ts');
test('statistics CSV preserves Japanese names and neutralizes spreadsheet formulas',()=>{
 const csv=statisticsCSV([['表示名','順位'],['=HYPERLINK("bad")',1],['\t+cmd',2],['会員,"名前"',3]]);
 assert.ok(csv.startsWith('\ufeff'));assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));assert.ok(csv.includes('"\'\t+cmd"'));assert.ok(csv.includes('"会員,""名前"""'));assert.equal(csv.split('\r\n').length,4);
});
