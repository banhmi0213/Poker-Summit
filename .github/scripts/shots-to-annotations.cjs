// CI only: re-encode a few screenshots as small JPEGs and print them as base64 notice annotations, so a session that
// can read annotations (but not artifacts) can look at them. Usage: node shots-to-annotations.cjs <dir> <file>...
const fs=require('fs'),path=require('path');
(async()=>{const raw=require(process.env.POKER_CHROMIUM_MODULE),chromium=raw.default??raw,pw=require(process.env.POKER_PLAYWRIGHT_MODULE).chromium;
 const [dir,...files]=process.argv.slice(2);const browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args.filter(a=>!['--single-process','--no-zygote'].includes(a))});
 try{for(const f of files){const file=path.join(dir,f);if(!fs.existsSync(file)){console.log('::notice title=shot-missing::'+f);continue;}
  const page=await browser.newPage();const b64=fs.readFileSync(file).toString('base64');await page.setContent(`<body style="margin:0"><img id="i" src="data:image/png;base64,${b64}"></body>`);
  const size=await page.evaluate(()=>new Promise(r=>{const i=document.getElementById('i');const go=()=>r({w:i.naturalWidth,h:i.naturalHeight});i.complete?go():i.onload=go;}));
  const scale=Math.min(1,700/size.w);await page.setViewportSize({width:Math.round(size.w*scale),height:Math.round(size.h*scale)});await page.evaluate(s=>{const i=document.getElementById('i');i.style.width=(i.naturalWidth*s)+'px';},scale);
  const jpg=(await page.screenshot({type:'jpeg',quality:42})).toString('base64');await page.close();
  const parts=jpg.match(/.{1,60000}/g);parts.forEach((p,i)=>console.log(`::notice title=shot ${f} ${i+1}/${parts.length}::${p}`));}}
 finally{await browser.close();}})().catch(e=>{console.log('::notice title=shot-error::'+String(e).slice(0,200));});
