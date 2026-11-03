const assert = require('node:assert/strict');
const fs=require('fs'),path=require('path');
const {chromium}=require(process.env.ACADEMY_PLAYWRIGHT_MODULE || 'playwright');
const chromiumModule=require(process.env.ACADEMY_CHROMIUM_MODULE || '@sparticuz/chromium');
const chrome=chromiumModule.default || chromiumModule;
const esbuild=require(process.env.ACADEMY_ESBUILD_MODULE || 'esbuild');
const root=process.cwd();
const previewDir=fs.mkdtempSync(path.join(require('os').tmpdir(),'academy-level3-'));
const screenshots=process.env.ACADEMY_SCREENSHOT_DIR;
const ts=require(path.join(process.cwd(),'node_modules/typescript'));
const mod={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('app/learn/level-three-content.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod,mod.exports);
const {levelThreeLessons,levelThreeExam,LEVEL_THREE_STORAGE_KEY}=mod.exports;
(async()=>{
await esbuild.build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {Academy} from './app/learn/academy';createRoot(document.getElementById('root')).render(<Academy/>);`,resolveDir:root,sourcefile:'preview.tsx',loader:'tsx'},bundle:true,banner:{js:'var process={env:{NODE_ENV:"production"},browser:true};'},jsx:'automatic',outdir:previewDir,entryNames:'bundle',nodePaths:[path.join(root,'node_modules')],define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_SUPABASE_URL':'"https://example.supabase.co"','process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY':'"test-public-placeholder"'},platform:'browser'});
fs.mkdirSync(path.join(previewDir,'images'));
fs.copyFileSync(path.join(root,'public/images/academy-learning-hero-v1.webp'),path.join(previewDir,'images/academy-learning-hero-v1.webp'));
fs.copyFileSync(path.join(root,'assets/fonts/BIZUDPGothic-Regular-jis.ttf'),path.join(previewDir,'font.ttf'));
fs.writeFileSync(path.join(previewDir,'index.html'),'<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>@font-face{font-family:AcademyQA;src:url(/font.ttf)}*{box-sizing:border-box}body{margin:0;background:#fcf7ef;font-family:AcademyQA,Arial,sans-serif;color:#352818}#root{max-width:1200px;margin:auto;padding:20px}@media(max-width:550px){#root{padding:12px}}</style><div id="root"></div><script src="/bundle.js"></script></html>');
const server=require('http').createServer((req,res)=>{const name=req.url==='/'?'index.html':req.url.slice(1);try{const data=fs.readFileSync(path.join(previewDir,name));res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':name.endsWith('.webp')?'image/webp':name.endsWith('.ttf')?'font/ttf':'text/html');res.end(data)}catch{res.statusCode=404;res.end()}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;const browser=await chromium.launch({executablePath:process.env.ACADEMY_CHROMIUM_PATH || await chrome.executablePath(),args:chrome.args,headless:true});const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:1000});await page.goto(url);
await page.getByRole('button',{name:/Lv.3 実戦チャレンジャー/}).click({timeout:5000}).catch(async e=>{console.log('ERRORS',errors,'BODY',await page.locator('body').innerText());throw e});await page.getByRole('heading',{name:'実戦チャレンジャー',exact:true}).waitFor();
assert.equal(await page.locator('#academy-course-hero a').getAttribute('href'),'#tools'); // GTO・学習 (2026/11/1): the hero button goes to the free tools
const nav=page.getByRole('navigation',{name:'Lv.3のレッスンを選ぶ'});
for(let i=0;i<levelThreeLessons.length;i++){
 const lesson=levelThreeLessons[i];await nav.getByRole('button',{name:new RegExp(lesson.title)}).click();
 assert.equal(await page.locator(`figure[data-lesson="${lesson.id}"]`).count(),1);
 const mark=page.getByRole('button',{name:'解説を確認して学習済みにする',exact:true});assert.equal(await mark.isEnabled(),false);
 if(lesson.id==='spr') {await page.getByLabel('自分の残りスタック',{exact:true}).fill('6000');await page.getByLabel('相手の残りスタック',{exact:true}).fill('4000');await page.getByLabel('現在のポット',{exact:true}).fill('2000');assert.match(await page.getByLabel('SPR計算演習').innerText(),/SPR 2/);await page.getByLabel('現在のポット',{exact:true}).fill('0');assert.match(await page.getByLabel('SPR計算演習').innerText(),/ポットは1以上/);await page.getByLabel('現在のポット',{exact:true}).fill('2000');}
 if(lesson.id==='betting'){await page.getByRole('button',{name:'100% POT',exact:true}).click();assert.match(await page.getByLabel('ベットサイズ比較').innerText(),/33.33%/);}
 if(lesson.id==='streets'){const ex=page.getByLabel('ストリート別カード演習');assert.equal(await ex.getByText('K♦',{exact:true}).count(),0);await ex.getByRole('button',{name:'ターンを開く',exact:true}).click();assert.equal(await ex.getByText('K♦',{exact:true}).count(),0);await ex.getByRole('button',{name:'リバーを開く',exact:true}).click();assert.equal(await ex.getByText('K♦',{exact:true}).count(),1);}
 for(let q=0;q<lesson.questions.length;q++){const item=lesson.questions[q];await page.getByRole('button',{name:item.choices[item.answer],exact:true}).click();assert.equal(await mark.isEnabled(),false);await page.getByRole('button',{name:q===1?'結果を見る':'次の問題へ',exact:true}).click();}
 assert.equal(await mark.isEnabled(),true);await mark.click();
}
assert.match(await page.getByLabel('Lv.3学習進捗').innerText(),/6 \/ 6/);
await nav.getByRole('button',{name:'07 実戦判断テスト',exact:true}).click();
for(let i=0;i<levelThreeExam.length;i++){const q=levelThreeExam[i];await page.getByRole('button',{name:q.choices[q.answer],exact:true}).click();if(i===11)assert.equal(await page.getByText('合格です。状況と理由を結びつける基本を確認できました。',{exact:true}).count(),0);await page.getByRole('button',{name:i===11?'結果を見る':'次の問題へ',exact:true}).click();}
assert.match(await page.getByLabel('Lv.3学習進捗').innerText(),/12 \/ 12/);
await page.getByRole('button',{name:'もう一度挑戦する',exact:true}).click();
for(let i=0;i<levelThreeExam.length;i++){const q=levelThreeExam[i];await page.getByRole('button',{name:q.choices[(q.answer+1)%3],exact:true}).click();await page.getByRole('button',{name:i===11?'結果を見る':'次の問題へ',exact:true}).click();}
assert.match(await page.getByLabel('Lv.3学習進捗').innerText(),/12 \/ 12/);
let saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),LEVEL_THREE_STORAGE_KEY);assert.equal(saved.completed.length,6);assert.equal(saved.bestScore,12);
await page.reload();await page.getByRole('button',{name:'Lv.3 実戦チャレンジャー 6レッスンと実戦判断テスト',exact:true}).click();await page.getByLabel('Lv.3学習進捗').getByText('6 / 6 レッスン学習済み',{exact:true}).waitFor();assert.match(await page.getByLabel('Lv.3学習進捗').innerText(),/6 \/ 6/);assert.match(await page.getByLabel('Lv.3学習進捗').innerText(),/12 \/ 12/);
for(const width of [1440,375,320]){await page.setViewportSize({width,height:1000});await nav.getByRole('button',{name:/スタックとSPR/}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.evaluate(()=>document.fonts.ready);if(screenshots){fs.mkdirSync(screenshots,{recursive:true});await page.screenshot({path:path.join(screenshots,`level3-${width}.png`),fullPage:true});}}
for(const width of [1440,375,320]){await page.setViewportSize({width,height:1000});for(const lesson of levelThreeLessons){await nav.getByRole('button',{name:new RegExp(lesson.title)}).click();const figure=page.locator(`figure[data-lesson="${lesson.id}"]`);await figure.waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(screenshots){await page.evaluate(()=>document.fonts.ready);await figure.screenshot({path:path.join(screenshots,`level3-diagram-${lesson.id}-${width}.png`)});}}}
await page.getByRole('button',{name:'Lv.1・2 初心者コース 基本の5レッスンと卒業テスト',exact:true}).click();
await page.locator('#academy-level-3 summary').click();await page.getByRole('button',{name:'Lv.3を学ぶ',exact:true}).click();await page.getByRole('heading',{name:'実戦チャレンジャー',exact:true}).waitFor();
assert.deepEqual(errors,[]);
const blocked=await browser.newContext();await blocked.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('blocked','SecurityError')};Storage.prototype.getItem=function(){throw new DOMException('blocked','SecurityError')};});const blockedPage=await blocked.newPage();await blockedPage.goto(url);await blockedPage.getByRole('button',{name:'Lv.3 実戦チャレンジャー 6レッスンと実戦判断テスト',exact:true}).click();await blockedPage.getByText('ブラウザへの保存が利用できません。',{exact:false}).waitFor();
console.log('PASS: 6 lessons, 12 practice questions, all exam answers and retry, best-score persistence/reload, calculator validation, ordered runout, desktop/375/320 no horizontal overflow, blocked storage fallback, no runtime errors');await browser.close();server.close();fs.rmSync(previewDir,{recursive:true,force:true});})().catch(e=>{console.error(e);process.exit(1)});
