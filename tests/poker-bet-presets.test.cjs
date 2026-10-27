const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,f);
const {parseBetPreferences,defaultBetPreferences,presetRaiseTo,quickBetKind,quickBetValues,quickBetLabel,quickBetTo}=require('../lib/poker/bet-presets.ts');
test('member bet sizes accept independent BB and POT arrays without persisting extra metadata',()=>{const p=parseBetPreferences({bb:true,multipliers:[2.25,3,5],potPercentages:[25,60,90,125],email:'never store'});assert.deepEqual(p,{bb:true,multipliers:[2.25,3,5],potPercentages:[25,60,90,125],raiseMultipliers:[2.5,3,3.5,4],runItTwice:'ask',tableSkin:'standard',cardSkin:'standard'});assert.equal(parseBetPreferences({...p,tableSkin:'velvet-red'}).tableSkin,'velvet-red');assert.throws(()=>parseBetPreferences({...p,cardSkin:'<script>'}));assert.deepEqual(parseBetPreferences({...p,raiseMultipliers:[2,2.2,3,6]}).raiseMultipliers,[2,2.2,3,6]);for(const bad of [[2,3,4],[1,2,3,4],[2,3,4,21]])assert.throws(()=>parseBetPreferences({...p,raiseMultipliers:bad}));assert.equal(parseBetPreferences({...p,runItTwice:'twice'}).runItTwice,'twice');assert.throws(()=>parseBetPreferences({...p,runItTwice:'always'}));assert.deepEqual(parseBetPreferences(defaultBetPreferences),defaultBetPreferences);for(const value of [NaN,Infinity,-1,0,501,'50'])assert.throws(()=>parseBetPreferences({...p,potPercentages:[25,60,90,value]}));assert.throws(()=>parseBetPreferences({...p,multipliers:[2,3]}));});
test('pot buttons account for the call and existing commitment, then clamp legal limits',()=>{const base={preflop:false,bb:100,pot:1000,call:200,committed:100,min:500,max:5000};assert.equal(presetRaiseTo({...base,value:50}),900);assert.equal(presetRaiseTo({...base,value:100}),1500);assert.equal(presetRaiseTo({...base,value:1}),500);assert.equal(presetRaiseTo({...base,value:500,max:1700}),1700);assert.equal(presetRaiseTo({...base,preflop:true,value:2.5,min:200}),250);assert.equal(presetRaiseTo({...base,call:0,committed:0,min:100,value:33}),330);});
test('facing an opponent bet or raise, the buttons are multiples of that bet',()=>{
 const prefs=defaultBetPreferences;
 assert.equal(quickBetKind({preflop:true,currentBet:100,bb:100}),'bb'); // unopened or limped
 assert.equal(quickBetKind({preflop:true,currentBet:250,bb:100}),'times'); // facing an open: 3-bet sizes
 assert.equal(quickBetKind({preflop:false,currentBet:0,bb:100}),'pot');
 assert.equal(quickBetKind({preflop:false,currentBet:300,bb:100}),'times');
 assert.deepEqual(quickBetValues('times',prefs),[2.5,3,3.5,4]);assert.equal(quickBetLabel('times',3),'3倍');assert.equal(quickBetLabel('pot',50),'50% POT');assert.equal(quickBetLabel('bb',2.5),'2.5 BB');
 const base={bb:100,pot:1000,call:300,committed:0,currentBet:300,min:600,max:5000};
 assert.equal(quickBetTo('times',{...base,value:3}),900);assert.equal(quickBetTo('times',{...base,value:2.5}),750);
 assert.equal(quickBetTo('times',{...base,value:1.5}),600,'never below the minimum raise');assert.equal(quickBetTo('times',{...base,value:20}),5000,'never above the stack');
 assert.equal(quickBetTo('pot',{...base,call:0,currentBet:0,min:100,value:50}),500);
});
