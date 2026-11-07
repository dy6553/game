import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const original=await readFile(new URL('../server/worker.js',import.meta.url),'utf8');
const source=original.replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env;}}').replaceAll("'../src/network-game.ts'",JSON.stringify(new URL('../src/network-game.ts',import.meta.url).href)).replaceAll("'./account-auth.js'",JSON.stringify(new URL('../server/account-auth.js',import.meta.url).href)).replaceAll("'./official-records.js'",JSON.stringify(new URL('../server/official-records.js',import.meta.url).href)).replaceAll("'./record-store.js'",JSON.stringify(new URL('../server/record-store.js',import.meta.url).href));
const {default:worker,Room}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
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
 const response=await worker.fetch(new Request('https://worker/session',{method:'POST',headers:{Origin:'https://game.test'},body:JSON.stringify({action:'create',accountSubject:'victim',userId:'victim'})}),env);
 assert.equal(response.status,200);assert.equal(forwarded.accountSubject,undefined);assert.equal(forwarded.userId,undefined);
});
