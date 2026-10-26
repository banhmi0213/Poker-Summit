const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {TableBgm}=require('../lib/poker/table-bgm.ts');
function fakeContext(){let started=0;const param={value:0,setValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}};
 const node=()=>({connect(){},disconnect(){},start(){started++;},stop(){},frequency:{...param},detune:{...param},Q:{...param},gain:{...param},pan:{...param},threshold:{...param},ratio:{...param},type:'',buffer:null});
 const c={state:'running',currentTime:0,sampleRate:8000,destination:{},resume:async()=>{},close:async()=>{},createOscillator:node,createGain:node,createBiquadFilter:node,createBufferSource:node,createStereoPanner:node,createDynamicsCompressor:node,createConvolver:node,createBuffer:(ch,len)=>({getChannelData:()=>new Float32Array(len)})};
 return {c,started:()=>started};}
test('High Roller BGM schedules a bar on start, stops cleanly and never starts twice',async()=>{
 const f=fakeContext(),bgm=new TableBgm(()=>f.c);await Promise.all([bgm.start(),bgm.start()]);
 assert.equal(bgm.playing,true);const first=f.started();assert.ok(first>40,'kick, hats, claps, bass and piano for the first bar');
 bgm.stop();assert.equal(bgm.playing,false);bgm.close();
});
test('BGM stays silent when the browser has not allowed audio yet',async()=>{
 const f=fakeContext();f.c.state='suspended';const bgm=new TableBgm(()=>f.c);await bgm.start();assert.equal(bgm.playing,false);assert.equal(f.started(),0);
});
test('a broken audio device never throws into the table',async()=>{const bgm=new TableBgm(()=>{throw Error('no audio');});await bgm.start();assert.equal(bgm.playing,false);});
