const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {PokerSounds}=require('../lib/poker/online-sounds.ts'),{onlineSoundEvents}=require('../lib/poker/sound-events.ts');
const snapshot=(change={})=>({youSeat:1,hand:{handId:'h1',revision:0,board:[],toAct:'seat-1',result:null,...change}});
test('audio requires gesture unlock, obeys mute, supports every cue and closes without touching game state',async()=>{
 let made=0,started=0,closed=0,resumed=0;const param={setValueAtTime(){},exponentialRampToValueAtTime(){}};
 const node=()=>({connect(){},disconnect(){},start(){started++;},stop(){},frequency:{...param,value:0},Q:{value:0},gain:param});
 const context={state:'suspended',currentTime:0,sampleRate:8000,destination:{},resume:async()=>{resumed++;context.state='running';},close:async()=>{closed++;},createOscillator:node,createGain:node,createBiquadFilter:node,createBufferSource:node,createBuffer:()=>({getChannelData:()=>new Float32Array(1200)})};
 const sound=new PokerSounds(()=>{made++;return context;});assert.equal(sound.play('enter'),0);assert.equal(made,0);await sound.unlock();assert.equal(made,1);assert.equal(resumed,1);
 for(const kind of ['turn','action','deal','win','enter','exit'])assert.ok(sound.play(kind)>0);assert.equal(started,12);
 sound.setEnabled(false);assert.equal(sound.play('win'),0);assert.equal(started,12);await sound.unlock();assert.equal(made,1);sound.close();assert.equal(closed,1);assert.equal(sound.play('exit'),0);await sound.unlock();assert.equal(made,1);
 const broken=new PokerSounds(()=>{throw Error('Audio unavailable');});await broken.unlock();assert.equal(broken.play('enter'),0);broken.close();
});
test('polls and reconnect do not replay sounds; new hand, street, own turn and result produce their cues once',()=>{
 let state=snapshot(),r=onlineSoundEvents(null,state);assert.deepEqual(r.sounds,[]);
 assert.deepEqual(onlineSoundEvents(r.marker,state).sounds,[]);
 let next=onlineSoundEvents(r.marker,snapshot({revision:1,toAct:'seat-6'}));assert.deepEqual(next.sounds,['action']);
 r=onlineSoundEvents(next.marker,snapshot({revision:2,toAct:'seat-1',board:[1,2,3]}));assert.deepEqual(r.sounds,['deal','action','turn']);
 next=onlineSoundEvents(r.marker,snapshot({revision:3,toAct:null,board:[1,2,3,4,5],result:{}}));assert.deepEqual(next.sounds,['deal','action','win']);assert.deepEqual(onlineSoundEvents(next.marker,snapshot({revision:3,toAct:null,board:[1,2,3,4,5],result:{}})).sounds,[]);
 assert.deepEqual(onlineSoundEvents(null,snapshot({result:{}})).sounds,[]);
 r=onlineSoundEvents(next.marker,snapshot({handId:'h2'}));assert.deepEqual(r.sounds,['deal','turn']);
 const waiting=onlineSoundEvents(null,{youSeat:1,hand:null});assert.deepEqual(onlineSoundEvents(waiting.marker,snapshot()).sounds,['deal','turn']);assert.equal(onlineSoundEvents(r.marker,null).marker,null);
});
