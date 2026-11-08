import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const original=await readFile(new URL('../server/worker.js',import.meta.url),'utf8');
const source=original.replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env;}}').replaceAll("'../src/network-game.ts'",JSON.stringify(new URL('../src/network-game.ts',import.meta.url).href)).replaceAll("'./account-auth.js'",JSON.stringify(new URL('../server/account-auth.js',import.meta.url).href)).replaceAll("'./official-records.js'",JSON.stringify(new URL('../server/official-records.js',import.meta.url).href)).replaceAll("'./record-store.js'",JSON.stringify(new URL('../server/record-store.js',import.meta.url).href)).replaceAll("'./account-health.js'",JSON.stringify(new URL('../server/account-health.js',import.meta.url).href)).replaceAll("'./account-delete.js'",JSON.stringify(new URL('../server/account-delete.js',import.meta.url).href));
const {default:worker,Room}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('read-only account readiness is available before enabling login and respects allowed origins',async()=>{
 const env={ALLOWED_ORIGINS:'https://game.test'};
 const response=await worker.fetch(new Request('https://worker/health/accounts',{headers:{Origin:'https://game.test'}}),env);assert.equal(response.status,200);assert.deepEqual(await response.json(),{databaseConfigured:false,database:'missing',authConfigured:false,enabled:false,ready:false});
 const denied=await worker.fetch(new Request('https://worker/health/accounts',{headers:{Origin:'https://untrusted.test'}}),env);assert.equal(denied.status,403);
});
test('invalid authentication is rejected before a lobby receives a reservation',async()=>{
 let reserved=false;const env={ALLOWED_ORIGINS:'https://game.test',LOBBY:{idFromName(){},get(){return {fetch(){reserved=true;return Response.json({});}};}}};
 const request=()=>new Request('https://worker/session',{method:'POST',headers:{Origin:'https://game.test','Content-Type':'application/json',Authorization:'Bearer invalid'},body:JSON.stringify({action:'create',userId:'victim'})});
 const response=await worker.fetch(request(),env);assert.equal(response.status,401);assert.equal(reserved,false);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://game.test');
 const preflight=await worker.fetch(new Request('https://worker/session',{method:'OPTIONS',headers:{Origin:'https://game.test'}}),env);assert.match(preflight.headers.get('Access-Control-Allow-Headers'),/Authorization/i);
});
test('room cleanup preserves pending official writes and does not leak identities into state',async()=>{
 const values=new Map([['official-outbox',[{matchId:'pending'}]]]);const tasks=[];
 const ctx={storage:{async get(k){return values.get(k);},async put(k,v){values.set(k,v);},async delete(k){values.delete(k);},async deleteAll(){values.clear();},async setAlarm(){}},blockConcurrencyWhile(fn){return fn();},waitUntil(p){tasks.push(p);}};
 const room=new Room(ctx,{});await new Promise(r=>setTimeout(r,0));
 await room.fetch(new Request('https://room/reserve',{method:'POST',body:JSON.stringify({weapon:'pistol',accountSubject:'private-user'})}));
 assert.equal(JSON.stringify(room.game.state).includes('private-user'),false);
 room.closeRoom('test');await Promise.all(tasks);assert.ok(values.has('official-outbox'));
});
test('a guest cannot choose another account ID when reserving a room',async()=>{
 let forwarded;const env={ALLOWED_ORIGINS:'https://game.test',LOBBY:{idFromName(){},get(){return {async fetch(request){forwarded=await request.json();return Response.json({code:'1234ABCD'});}};}}};
 const response=await worker.fetch(new Request('https://worker/session',{method:'POST',headers:{Origin:'https://game.test'},body:JSON.stringify({action:'create',nickname:'검사대원',accountSubject:'victim',userId:'victim'})}),env);
 assert.equal(response.status,200);assert.equal(forwarded.accountSubject,undefined);assert.equal(forwarded.userId,undefined);
});
test('account deletion requires a verified login before opening the DB',async()=>{
 const env={ALLOWED_ORIGINS:'https://game.test',ACCOUNTS_ENABLED:'true'};
 const response=await worker.fetch(new Request('https://worker/account',{method:'DELETE',headers:{Origin:'https://game.test'},body:JSON.stringify({password:'correct-password',userId:'victim'})}),env);assert.equal(response.status,401);
});
test('factory and welding unlocks cannot be forged by guests; growth requires login',async()=>{
 let reserved=false;const env={ALLOWED_ORIGINS:'https://game.test',ACCOUNTS_ENABLED:'true',LOBBY:{idFromName(){},get(){return {fetch(){reserved=true;return Response.json({});}};}}};
 for(const body of [{action:'create',map:'factory',accountLevel:99,accountSubject:'victim'},{action:'create',character:'welder',accountLevel:99}]){
  const res=await worker.fetch(new Request('https://worker/session',{method:'POST',headers:{Origin:'https://game.test'},body:JSON.stringify(body)}),env);assert.equal(res.status,403);assert.equal(reserved,false);
 }
 for(const path of ['/growth/start','/growth/finish/00000000-0000-4000-8000-000000000000']){
  const res=await worker.fetch(new Request('https://worker'+path,{method:'POST',headers:{Origin:'https://game.test'},body:'{}'}),env);assert.equal(res.status,401);
 }
});
test('factory room checks actual room map for joining and preserves map in checkpoint',async()=>{
 const values=new Map();const ctx={storage:{async get(k){return values.get(k);},async put(k,v){values.set(k,v);},async setAlarm(){}},blockConcurrencyWhile(fn){return fn();},waitUntil(){}};
 const room=new Room(ctx,{});await new Promise(r=>setTimeout(r,0));
 const reserve=body=>room.fetch(new Request('https://room/reserve',{method:'POST',body:JSON.stringify(body)}));
 assert.equal((await reserve({map:'factory',accountSubject:'a',accountLevel:2})).status,403);
 assert.equal((await reserve({map:'factory',accountSubject:'a',accountLevel:3})).status,200);
 assert.equal(values.get('checkpoint').state.map,'factory');
 assert.equal((await reserve({map:'harbor',accountSubject:'b',accountLevel:1})).status,403,'joining an unlocked map checks actual room regardless of requested map');
 assert.equal((await reserve({map:'harbor',accountSubject:'b',accountLevel:3})).status,200);
});

test('nickname saving requires verified login before accessing the database',async()=>{const env={ALLOWED_ORIGINS:'https://game.test',ACCOUNTS_ENABLED:'true'};const r=await worker.fetch(new Request('https://worker/account/nickname',{method:'POST',headers:{Origin:'https://game.test'},body:JSON.stringify({nickname:'남의이름',subject:'victim'})}),env);assert.equal(r.status,401);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://game.test');});
test('guest sessions reject missing or unsafe display names before room reservation',async()=>{let reserved=false;const env={ALLOWED_ORIGINS:'https://game.test',LOBBY:{idFromName(){},get(){return {fetch(){reserved=true;return Response.json({});}};}}};for(const nickname of [undefined,'<script>','a@example.com']){const r=await worker.fetch(new Request('https://worker/session',{method:'POST',headers:{Origin:'https://game.test'},body:JSON.stringify({action:'create',nickname})}),env);assert.equal(r.status,400);}assert.equal(reserved,false);});
