// Compile only the dedicated server dependency graph, independently of Next pages.
const ts=require('typescript'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..'),outDir=path.join(root,'.poker-server');
fs.rmSync(outDir,{recursive:true,force:true});
const program=ts.createProgram([path.join(root,'lib/poker/room-server-entry.ts'),path.join(root,'lib/poker/staging-check-entry.ts'),path.join(root,'lib/poker/bot-worker.ts')],{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,moduleResolution:ts.ModuleResolutionKind.Node10,lib:['lib.es2022.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts'],strict:true,esModuleInterop:true,skipLibCheck:true,noEmitOnError:true,resolveJsonModule:true,baseUrl:root,paths:{'@/*':['./*']},rootDir:root,outDir,types:['node']});
const result=program.emit(),diagnostics=[...ts.getPreEmitDiagnostics(program),...result.diagnostics];
// Node cannot resolve the '@/' alias: point those requires at the emitted files.
if(!diagnostics.length){const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
 for(const f of walk(outDir).filter(f=>f.endsWith('.js'))){const src=fs.readFileSync(f,'utf8'),out=src.replace(/require\("@\/([^"]+)"\)/g,(_,p)=>{let rel=path.relative(path.dirname(f),path.join(outDir,p)).split(path.sep).join('/');if(!rel.startsWith('.'))rel='./'+rel;return `require("${rel}")`;});if(out!==src)fs.writeFileSync(f,out);}}
if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));process.exitCode=1;}
