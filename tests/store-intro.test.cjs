const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {buildStoreIntro,townFromAddress,parseGoogleHours,hoursSentence}=require('../lib/store-intro.ts');
const week=(f)=>['月','火','水','木','金','土','日'].map(f);

test('town is taken from the address in its usual formats',()=>{
 assert.equal(townFromAddress('〒160-0022 東京都新宿区新宿５丁目１６−４ 新宿マルイメン 6階','東京都','新宿区'),'新宿');
 assert.equal(townFromAddress('大阪府堺市堺区戎之町東3丁1-9 オクムラビル2F','大阪府','堺市'),'戎之町東');
 assert.equal(townFromAddress('千葉県千葉市中央区富士見1-10-6 3F','千葉県','千葉市'),'富士見');
 assert.equal(townFromAddress('〒980-0811 宮城県仙台市青葉区一番町４丁目２−４ オーシャンビル 3F','宮城県','仙台市'),'一番町');
 assert.equal(townFromAddress('尾崎ビル 2F, ２丁目-１５-21 曙町 立川市 東京都 190-0012','東京都','立川市'),'');
});

test('hours: closed days, usual times, late night and daytime notes',()=>{
 const late=parseGoogleHours(week(d=>d==='木'||d==='日'?`${d}曜日: 定休日`:`${d}曜日: 12時00分～5時00分`));
 assert.equal(hoursSentence(late),'木・日曜が定休日で、12時ごろから翌5時ごろまで営業しています。昼から開いているので、明るい時間にも楽しめます。終電を逃しても遊べる深夜型のお店です。');
 const weekendDay=parseGoogleHours(week(d=>d==='土'||d==='日'?`${d}曜日: 13時00分～23時00分`:`${d}曜日: 18時30分～23時00分`));
 assert.equal(hoursSentence(weekendDay),'毎日18時30分ごろから23時ごろまで営業しています。土日は13時から開いているので、昼間から遊べます。');
 const midnight=parseGoogleHours(week(d=>`${d}曜日: 19時00分～0時00分`));
 assert.equal(hoursSentence(midnight),'毎日19時ごろから24時ごろまで営業しています。');
 const allDay=parseGoogleHours(week(d=>`${d}曜日: 24 時間営業`));
 assert.match(hoursSentence(allDay),/24時間営業/);
 assert.equal(hoursSentence(parseGoogleHours(['月曜日: 19時00分～0時00分'])),'','incomplete week says nothing');
});

test('intro uses nearby stores, city count, events and SNS; never invents missing facts',()=>{
 const base={name:'A店',categoryLabel:'アミューズメントポーカー店',pref:'東京都',city:'豊島区',cityNickname:'池袋',address:'東京都豊島区西池袋1丁目2-3',station:null,hoursText:null,googleHoursText:null,nearby:[{name:'B店',km:0.2},{name:'C店',km:0.9},{name:'D店',km:3}],cityStoreCount:12,upcomingEvents:0,hasX:true,hasInstagram:false,siteName:'ポーカーサミット'};
 const p=buildStoreIntro(base);
 assert.equal(p[0],'A店は、東京都豊島区の西池袋にあるアミューズメントポーカー店です。');
 assert.equal(buildStoreIntro({...base,address:null})[0],'A店は、東京都豊島区（池袋エリア）にあるアミューズメントポーカー店です。');
 assert.equal(townFromAddress('東京都港区芝5-16-7 芝ビル1F B号室','東京都','港区'),'芝');
 assert.equal(p[1],'近くにはB店（約0.2km）やC店（約0.9km）もあり、何軒か回りやすいエリアです。豊島区では、A店を含めて12店舗を掲載しています。');
 assert.match(p[2],/店舗のXでも発信/);assert.doesNotMatch(p.join(''),/最寄り駅|イベントの開催が予定/);
 const alone=buildStoreIntro({...base,city:'霧島市',cityNickname:null,address:'鹿児島県霧島市国分中央3丁目12-1',pref:'鹿児島県',nearby:[{name:'E店',km:24.3}],cityStoreCount:1,upcomingEvents:2,hasX:false});
 assert.match(alone[1],/E店（約24.3km）がいちばん近い/);assert.match(alone[1],/霧島市でポーカーサミットに掲載しているのは、いまのところA店だけ/);
 assert.match(alone[2],/2件のトーナメント/);assert.doesNotMatch(alone[2],/X|Instagram/);
});
