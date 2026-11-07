import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT} from '../server/node_modules/jose/dist/webapi/index.js';
import {runApprovedCleanup} from '../server/approved-cleanup.js';
import {approvedSQL,config as deployedConfig} from '../server/approved-cleanup-config.js';
const now=Date.now();const pair=await generateKeyPair('EdDSA');const config={...deployedConfig,publicKey:await exportJWK(pair.publicKey),deadline:now+600000};
const proof=()=>new SignJWT({sql:config.sqlHash}).setProtectedHeader({alg:'EdDSA'}).setIssuer('harbor-approved-maintenance').setAudience('https://game.yuni100106yuni.workers.dev').setSubject(config.job).setIssuedAt(Math.floor(now/1000)).setExpirationTime(Math.floor(now/1000)+120).sign(pair.privateKey);
const request=(token='',body='{}')=>new Request('https://game.yuni100106yuni.workers.dev/maintenance/approved-test-cleanup',{method:'POST',headers:token?{Authorization:'Bearer '+token}:{},body});
test('the approved bounded SQL requires the short-lived dedicated signing identity',async()=>{
 let queries=0;const query=async sql=>{queries++;assert.equal(sql,approvedSQL);assert.match(sql,/p\.played = 1 AND p\.wins = 1/);assert.match(sql,/d4020234-1b75-4835-8a36-b0916847c61f/);return [{email:'synthetic'}];};
 assert.equal((await runApprovedCleanup(request(),{}, {config,query,now})).status,401);assert.equal(queries,0);
 const result=await runApprovedCleanup(request(await proof()),{}, {config,query,now});assert.equal(result.status,200);assert.deepEqual(await result.json(),{ok:true,deleted:1});assert.equal(queries,1);
});
test('invalid proof, expiration and request-supplied selectors cannot execute SQL',async()=>{
 let queries=0;const options={config,now,query:async()=>{queries++;return [];}};
 assert.equal((await runApprovedCleanup(request('invalid'),{},options)).status,401);
 assert.equal((await runApprovedCleanup(request(await proof()),{}, {...options,now:config.deadline+1})).status,410);
 assert.equal((await runApprovedCleanup(request(await proof(),JSON.stringify({sql:'DELETE FROM users'})),{}, options)).status,400);
 assert.equal(queries,0);
});
