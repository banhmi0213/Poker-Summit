const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const source=fs.readFileSync('lib/job-categories.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const box={exports:{}};new Function('module','exports',compiled)(box,box.exports);

const {readJobSearch,matchesJobSearch}=box.exports;
const jobs=[
 {id:1,job_role:'ディーラー',job_type:'正社員'},
 {id:2,job_role:'ディーラー',job_type:'アルバイト'},
 {id:3,job_role:'ホールスタッフ',job_type:'正社員'},
 {id:4,job_role:'ホールスタッフ',job_type:'パート'},
];
const results=(role,type)=>jobs.filter(job=>matchesJobSearch(job,role,type)).map(job=>job.id);
assert.deepEqual(results('ディーラー','正社員'),[1]);
assert.deepEqual(results('ホールスタッフ','正社員'),[3]);
assert.deepEqual(results('ディーラー','アルバイト'),[2]);
assert.deepEqual(results('','正社員'),[1,3]);
assert.deepEqual(results('ディーラー',''),[1,2]);
assert.deepEqual(results('',''),[1,2,3,4]);
assert(matchesJobSearch({title:'ディーラー募集',job_type:'正社員'},'ディーラー','正社員'));
assert(!matchesJobSearch({job_role:'ホールスタッフ',title:'ディーラー募集',job_type:'正社員'},'ディーラー','正社員'));
assert.deepEqual(readJobSearch({category:['ディーラー','正社員']}),{role:'ディーラー',jobType:'正社員'});
assert.deepEqual(readJobSearch({role:'',jobType:'',category:['ディーラー','正社員']}),{role:'',jobType:''});
assert.deepEqual(readJobSearch({category:['ディーラー','正社員'],jobType:''}),{role:'ディーラー',jobType:'正社員'});
assert.deepEqual(readJobSearch({jobType:'正社員'}),{role:'',jobType:'正社員'});
console.log('PASS: role AND employment, single result per listing, legacy category URLs and explicit reset');
