// Compile only the dedicated server dependency graph, independently of Next pages.
const ts=require('typescript'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..'),outDir=path.join(root,'.poker-server');
fs.rmSync(outDir,{recursive:true,force:true});
const program=ts.createProgram([path.join(root,'lib/poker/room-server-entry.ts'),path.join(root,'lib/poker/staging-check-entry.ts')],{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,moduleResolution:ts.ModuleResolutionKind.Node10,lib:['lib.es2022.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts'],strict:true,esModuleInterop:true,skipLibCheck:true,noEmitOnError:true,rootDir:root,outDir,types:['node']});
const result=program.emit(),diagnostics=[...ts.getPreEmitDiagnostics(program),...result.diagnostics];
if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));process.exitCode=1;}
