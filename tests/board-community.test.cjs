const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
const filename = path.join(__dirname,'../lib/board-community.ts');
const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};new Function('require','module','exports',compiled)(require,mod,mod.exports);
const {encodeMentions,splitMentions}=mod.exports;
const a={user_id:'a1000000-0000-4000-8000-000000000001',display_name:'太郎'};
const b={user_id:'a1000000-0000-4000-8000-000000000002',display_name:'太郎さん'};
test('only explicitly selected, complete names become mention tokens',()=>{
 assert.equal(encodeMentions('@太郎 @太郎さん、ありがとう @everyone',[a,b]),`@[太郎](${a.user_id}) @[太郎さん](${b.user_id})、ありがとう @everyone`);
 assert.equal(encodeMentions('@太郎さんありがとう',[a]),'@太郎さんありがとう');
 assert.equal(encodeMentions('mail@example.com',[a]),'mail@example.com');
});
test('special characters in a handle are escaped, not interpreted as regex',()=>{
 const m={...a,display_name:'A+B.(ポーカー)'};
 assert.equal(encodeMentions('@A+B.(ポーカー) ありがとう',[m]),`@[A+B.(ポーカー)](${a.user_id}) ありがとう`);
});
test('render parts retain surrounding text and identify correct target IDs',()=>{
 assert.deepEqual(splitMentions(`こんにちは @[太郎](${a.user_id})！`),[{text:'こんにちは '},{text:'@太郎',userId:a.user_id},{text:'！'}]);
 assert.deepEqual(splitMentions('@[太郎](javascript:alert(1))'),[{text:'@[太郎](javascript:alert(1))'}]);
});
test('separate renders cannot share mutable global-regex cursor',()=>{
 const body=`@[太郎](${a.user_id})`;
 assert.deepEqual(splitMentions(body),splitMentions(body));
});
