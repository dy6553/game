import {captureOfficialResult,createResultOutbox} from '../server/official-records.js';
import {createIdentityVerifier} from '../server/account-auth.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createNetworkGame } from '../src/network-game.ts';

// Execute the actual Worker room against a deterministic runtime, without waiting 30 real seconds.
async function runtime(saved?:unknown){
 let now=1000;const intervals=new Set<()=>void>(),pairs:any[]=[];const storage=new Map(saved?[['checkpoint',saved]]:[]);
 const source=readFileSync(new URL('../server/worker.js',import.meta.url),'utf8').split('export class Lobby')[0]!.replace(/^import .*;\n/gm,'').replace('export class Room','class Room');
 const ctx={storage:{async get(k:string){return storage.get(k);},async put(k:string,v:unknown){storage.set(k,structuredClone(v));},async setAlarm(){},async delete(k:string){storage.delete(k);},async deleteAll(){storage.clear();}},blockConcurrencyWhile:async(f:()=>unknown)=>f(),waitUntil:(p:Promise<unknown>)=>p};
 class Socket {handlers:any={};messages:any[]=[];closed=false;accept(){}send(s:string){this.messages.push(JSON.parse(s));}close(){this.closed=true;this.handlers.close?.();}addEventListener(n:string,f:any){this.handlers[n]=f;}hello(token:string){this.handlers.message({data:JSON.stringify({type:'hello',token})});}}
 const sandbox:any={createNetworkGame,captureOfficialResult,createResultOutbox,createIdentityVerifier,Date:{now:()=>now},crypto:{randomUUID:()=>String(Math.random())},URL,Response:class{constructor(body:any,options:any){}},DurableObject:class{},setTimeout:()=>1,clearTimeout(){},setInterval:(f:()=>void)=>{intervals.add(f);return f;},clearInterval:(f:()=>void)=>intervals.delete(f),WebSocketPair:class{0=new Socket();1=new Socket();constructor(){pairs.push(this);}}};
 vm.runInNewContext(source+'\nglobalThis.Room=Room;',sandbox);
 const room=new sandbox.Room(ctx,{});await Promise.resolve();await Promise.resolve();
 async function connect(token:string){await room.fetch(new Request('https://room/ws',{headers:{Upgrade:'websocket'}}));const socket=pairs.at(-1)[1];socket.hello(token);return socket;}
 return {room,storage,connect,advance(ms:number){now+=ms;for(const f of [...intervals])f();}};
}
test('one returning player cannot reset the missing opponent reconnect deadline',async()=>{
 const r=await runtime();r.room.game.join('a');r.room.game.join('b');r.room.sessions={a:'a',b:'b'};
 const a=await r.connect('a'),b=await r.connect('b');r.advance(50);a.close();b.close();r.advance(20000);
 const returned=await r.connect('a');assert.equal(returned.closed,false);assert.equal(r.room.game.state.players[1].connected,false);
 r.advance(10001);assert.equal(returned.closed,true);assert.equal(r.room.game.state.players.length,0);
});
test('a room with both sockets closed rejects a reconnect after the grace period',async()=>{
 const r=await runtime();r.room.game.join('a');r.room.game.join('b');r.room.sessions={a:'a',b:'b'};
 const a=await r.connect('a'),b=await r.connect('b');r.advance(50);a.close();b.close();r.advance(30001);
 const late=await r.connect('a');assert.equal(late.closed,true);assert.equal(late.messages.length,0);assert.equal(r.room.game.state.players.length,0);
});
test('room checkpoint preserves reconnect deadlines and match lifecycle after restart',async()=>{
 const r=await runtime();r.room.game.join('a');r.room.game.join('b');r.room.sessions={a:'a',b:'b'};
 const a=await r.connect('a');await r.connect('b');r.advance(50);a.close();await r.room.save();
 const restored=await runtime(r.storage.get('checkpoint'));assert.equal(restored.room.matchStarted,true);assert.equal(restored.room.disconnectedAt,1050);assert.ok(restored.room.game.state.players.every((p:any)=>!p.connected));
});

test('storage alarm independently closes disconnected rooms without incoming packets',async()=>{
 const r=await runtime();r.room.game.join('a');r.room.game.join('b');r.room.sessions={a:'a',b:'b'};
 const a=await r.connect('a'),b=await r.connect('b');r.advance(50);a.close();b.close();const returned=await r.connect('a');
 await r.room.alarm();assert.equal(returned.closed,true);assert.equal(r.room.game.state.players.length,0);
});

test('new rooms receive a trusted player-region placement hint and ignore spoofed client hints',async()=>{
 const source=readFileSync(new URL('../server/worker.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replaceAll('export class ','class ').replace('export default ','globalThis.worker=');
 const sandbox:any={createNetworkGame,captureOfficialResult,createResultOutbox,createIdentityVerifier,Date,crypto,URL,Headers,Request,Response,DurableObject:class{ctx:any;env:any;constructor(ctx:any,env:any){this.ctx=ctx;this.env=env;}}};
 vm.runInNewContext(source+'\nglobalThis.Lobby=Lobby;',sandbox);
 const storage=new Map(),hints:any[]=[];
 const ctx={blockConcurrencyWhile:async(f:()=>unknown)=>f(),storage:{get:async(k:string)=>storage.get(k),put:async(k:string,v:unknown)=>storage.set(k,v),delete:async(k:string)=>storage.delete(k),setAlarm:async()=>{}}};
 const env:any={ALLOWED_ORIGINS:'https://project-3uu6s.vercel.app',ROOMS:{idFromName:(x:string)=>x,get:(_id:string,options:any)=>{hints.push(options?.locationHint);return{fetch:async()=>Response.json({id:'player',token:'token'})};}}};
 const lobby=new sandbox.Lobby(ctx,env);env.LOBBY={idFromName:(x:string)=>x,get:()=>lobby};
 for(const continent of ['AS',undefined]){
  const request=new Request('https://worker/session',{method:'POST',headers:{Origin:env.ALLOWED_ORIGINS,'X-Harbor-Location':'enam'},body:JSON.stringify({action:'create'})});
  if(continent)Object.defineProperty(request,'cf',{value:{continent}});
  assert.equal((await sandbox.worker.fetch(request,env)).status,200);
 }
 assert.deepEqual(hints,['apac',undefined]);
});
