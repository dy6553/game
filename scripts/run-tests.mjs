import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Release each file's 3D test fixtures before building the next scene batch.
const root=fileURLToPath(new URL('../',import.meta.url));
const files=readdirSync(new URL('../tests/',import.meta.url)).filter(name=>name.endsWith('.test.ts')).sort();
let tests=0,failed=0;
for(const file of files){
 const result=spawnSync(process.execPath,['--test','--test-isolation=none','--test-reporter=spec',`tests/${file}`],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
 process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');
 if(result.error){console.error(result.error.message);failed++;continue;}
 const count=Number(result.stdout.match(/ℹ tests (\d+)/)?.[1]??0);tests+=count;
 if(result.status!==0||count===0){console.error(`FAILED: ${file}`);failed++;}
}
console.log(`Total: ${tests} tests across ${files.length} files; ${failed} failed files.`);
process.exitCode=failed?1:0;
