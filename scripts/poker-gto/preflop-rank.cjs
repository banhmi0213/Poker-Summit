// Starting-hand order by all-in equity against a random hand (combo-weighted), best first.
// Output: data/poker-gto/preflop-rank.json {order:[169 labels], equity:{label:pct}}
const fs=require('fs'),path=require('path');
const {classes}=require('./common.cjs');
const M=require(path.resolve(__dirname,'../../data/poker-gto/preflop-equity.json'));
const tot=classes.reduce((s,c)=>s+c.combos,0);
const eqv=classes.map((c,i)=>classes.reduce((s,d,j)=>s+d.combos*M.eq[i][j],0)/tot/10000);
const order=classes.map((c,i)=>[c.label,eqv[i]]).sort((a,b)=>b[1]-a[1]);
fs.writeFileSync(path.resolve(__dirname,'../../data/poker-gto/preflop-rank.json'),JSON.stringify({version:1,basis:'equity vs a random hand',order:order.map(x=>x[0]),equity:Object.fromEntries(order.map(([l,e])=>[l,Math.round(e*1000)/10]))}));
console.log(order.slice(0,12).map(x=>x[0]+':'+(x[1]*100).toFixed(1)).join(' '),'...',order.slice(-3).map(x=>x[0]).join(' '));
