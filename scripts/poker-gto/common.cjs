// Shared helpers for offline GTO computations (run with: node scripts/poker-gto/<script>.cjs).
const fs=require('fs'),path=require('path');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/node-tools/node_modules/typescript');}
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {evalCodes}=require(path.resolve(__dirname,'../../lib/poker/fast-eval.ts'));
const R='23456789TJQKA';
// 169 classes: index order = pairs, suited, offsuit by ranks high-first. Label like "AKs", "QJo", "77".
const classes=[];for(let a=12;a>=0;a--)for(let b=12;b>=0;b--){if(a===b)classes.push({label:R[a]+R[b],hi:a,lo:b,suited:false,pair:true,combos:6});else if(a>b){classes.push({label:R[a]+R[b]+'s',hi:a,lo:b,suited:true,pair:false,combos:4});classes.push({label:R[a]+R[b]+'o',hi:a,lo:b,suited:false,pair:false,combos:12});}}
function combosOf(c){const out=[];for(let s1=0;s1<4;s1++)for(let s2=0;s2<4;s2++){if(c.pair&&s2<=s1)continue;if(!c.pair&&(c.suited?s1!==s2:s1===s2))continue;out.push([c.hi*4+s1,c.lo*4+s2]);}return out;}
function seeded(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
module.exports={evalCodes,classes,combosOf,seeded,R};
