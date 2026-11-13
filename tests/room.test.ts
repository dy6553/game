import {createServerClock} from '../src/server-clock.ts';
import {statePacket,privatePacket,recipientState} from '../src/network-wire.ts';
import {captureOfficialResult,createResultOutbox} from '../server/official-records.js';
import {createIdentityVerifier} from '../server/account-auth.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createNetworkGame,onlinePlaying,normalizeNickname } from '../src/network-game.ts';

// Execute the actual Worker room against a deterministic runtime, without waiting 30 real seconds.
async function runtime(saved?:unknown){
 let now=1000;const intervals=new Set<()=>void>(),pairs:any[]=[];const storage=new Map(saved?[['checkpoint',saved]]:[]);
 const source=readFileSync(new URL('../server/worker.js',import.meta.url),'utf8').split('export class Lobby')[0]!.replace(/^import .*;\r?\n/gm,'').replace('export class Room','class Room');
 const ctx={storage:{async get(k:string){return storage.get(k);},async put(k:string,v:unknown){storage.set(k,structuredClone(v));},async setAlarm(){},async delete(k:string){storage.delete(k);},async deleteAll(){storage.clear();}},blockConcurrencyWhile:async(f:()=>unknown)=>f(),waitUntil:(p:Promise<unknown>)=>p};
 class Socket {handlers:any={};messages:any[]=[];closed=false;accept(){}send(s:string){this.messages.push(JSON.parse(s));}close(){this.closed=true;this.handlers.close?.();}addEventListener(n:string,f:any){this.handlers[n]=f;}hello(token:string){this.handlers.message({data:JSON.stringify({type:'hello',token})});}}
 const sandbox:any={createServerClock,statePacket,privatePacket,recipientState,createNetworkGame,onlinePlaying,normalizeNickname,captureOfficialResult,createResultOutbox,createIdentityVerifier,Date:{now:()=>now},crypto:{randomUUID:()=>String(Math.random())},URL,Response:class{constructor(body:any,options:any){}static json(body:any,options:any){return Response.json(body,options);}},DurableObject:class{},setTimeout:()=>1,clearTimeout(){},setInterval:(f:()=>void)=>{intervals.add(f);return f;},clearInterval:(f:()=>void)=>intervals.delete(f),WebSocketPair:class{0=new Socket();1=new Socket();constructor(){pairs.push(this);}}};
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
 const source=readFileSync(new URL('../server/worker.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export class ','class ').replace('export default ','globalThis.worker=');
 const sandbox:any={createServerClock,statePacket,privatePacket,recipientState,createNetworkGame,onlinePlaying,normalizeNickname,captureOfficialResult,createResultOutbox,createIdentityVerifier,Date,crypto,URL,Headers,Request,Response,DurableObject:class{ctx:any;env:any;constructor(ctx:any,env:any){this.ctx=ctx;this.env=env;}}};
 vm.runInNewContext(source+'\nglobalThis.Lobby=Lobby;',sandbox);
 const storage=new Map(),hints:any[]=[];
 const ctx={blockConcurrencyWhile:async(f:()=>unknown)=>f(),storage:{get:async(k:string)=>storage.get(k),put:async(k:string,v:unknown)=>storage.set(k,v),delete:async(k:string)=>storage.delete(k),setAlarm:async()=>{}}};
 const env:any={ALLOWED_ORIGINS:'https://project-3uu6s.vercel.app',ROOMS:{idFromName:(x:string)=>x,get:(_id:string,options:any)=>{hints.push(options?.locationHint);return{fetch:async()=>Response.json({id:'player',token:'token'})};}}};
 const lobby=new sandbox.Lobby(ctx,env);env.LOBBY={idFromName:(x:string)=>x,get:()=>lobby};
 for(const continent of ['AS',undefined]){
  const request=new Request('https://worker/session',{method:'POST',headers:{Origin:env.ALLOWED_ORIGINS,'X-Harbor-Location':'enam'},body:JSON.stringify({action:'create',nickname:'검사대원'})});
  if(continent)Object.defineProperty(request,'cf',{value:{continent}});
  assert.equal((await sandbox.worker.fetch(request,env)).status,200);
 }
 assert.deepEqual(hints,['apac',undefined]);
});

test('twenty-player room keeps running when one leaves, expires reconnects individually and rejects late return',async()=>{
 const r=await runtime();r.room.game=createNetworkGame(undefined,'harbor',{mode:'ffa'});for(let i=0;i<20;i++){r.room.game.join('p'+i);r.room.sessions['t'+i]='p'+i;}
 const sockets=[];for(let i=0;i<20;i++)sockets.push(await r.connect('t'+i));r.advance(50);assert.equal(r.room.game.state.started,true);sockets[19].close();const tick=r.room.game.state.tick;r.advance(50);assert.ok(r.room.game.state.tick>tick);assert.equal(sockets[0].closed,false);r.advance(20000);const returned=await r.connect('t19');assert.equal(returned.closed,false);returned.close();r.room.stop();r.advance(30001);const late=await r.connect('t19');assert.equal(late.closed,true);assert.equal(r.room.game.state.players[19].abandoned,true);assert.equal(sockets[0].closed,false);
});

test('real room controls enforce the host and save no guest names, including reconnect rename',async()=>{const r=await runtime();r.room.game=createNetworkGame(undefined,'harbor',{waitingRoom:true});r.room.game.join('a','pistol','robot',{nickname:'임시이름',guest:true});r.room.game.join('b','pistol','robot',{nickname:'저장이름',guest:false});r.room.sessions={a:'a',b:'b'};const a=await r.connect('a'),b=await r.connect('b');r.advance(50);b.handlers.message({data:JSON.stringify({type:'start',id:'a'})});assert.equal(r.room.game.state.phase,'waiting');a.handlers.message({data:JSON.stringify({type:'start'})});assert.equal(r.room.game.state.phase,'playing');await r.room.save();assert.equal(JSON.stringify(r.storage.get('checkpoint')).includes('임시이름'),false);assert.equal(JSON.stringify(r.storage.get('checkpoint')).includes('저장이름'),true);a.close();assert.equal(b.messages.at(-1).state.players[0].nickname,undefined);const returned=await r.connect('a');assert.equal(returned.messages[0].state.players[0].nickname,undefined);returned.handlers.message({data:JSON.stringify({type:'nickname',nickname:'다시이름'})});assert.equal(r.room.game.state.players[0].nickname,'다시이름');await r.room.save();assert.equal(JSON.stringify(r.storage.get('checkpoint')).includes('다시이름'),false);});

test('late room timer catches up fixed ticks and broadcasts every shot event in that interval',async()=>{const r=await runtime();const a=r.room.game.join('a'),b=r.room.game.join('b');a.z=10;b.z=18;r.room.sessions={a:'a',b:'b'};const socket=await r.connect('a');await r.connect('b');r.room.game.input('a',{seq:1,x:0,y:0,yaw:0,pitch:0,shot:true,fire:false,reload:false,jump:false,sprint:false,scope:false});const tick=r.room.game.state.tick;r.advance(150);assert.equal(r.room.game.state.tick-tick,3);const packet=socket.messages.filter((m:any)=>m.type==='state').at(-1);assert.equal(packet.state.events.length,1);assert.equal(packet.state.players.find((p:any)=>p.id==='b').health,67);});

test('a late authenticated socket enters a running twenty-player match without a deploy message',async()=>{const r=await runtime();r.room.game=createNetworkGame(undefined,'harbor',{mode:'ffa',waitingRoom:true});r.room.game.join('host');r.room.game.join('first');r.room.sessions={host:'host',first:'first'};await r.connect('host');await r.connect('first');assert.equal(r.room.game.startMatch('host'),true);r.room.game.join('late','pistol','robot',{nickname:'합류대원',guest:true});r.room.sessions.late='late';const socket=await r.connect('late');const welcome=socket.messages.find((m:any)=>m.type==='welcome');assert.equal(welcome.state.players.find((p:any)=>p.id==='late').playing,true);assert.equal(welcome.state.players.find((p:any)=>p.id==='late').participated,true);assert.ok(welcome.state.players.find((p:any)=>p.id==='late').protection>0);});

test('joining an unknown room never creates a room reservation',async()=>{const r=await runtime();const response=await r.room.fetch(new Request('https://room/reserve',{method:'POST',body:JSON.stringify({action:'join',weapon:'pistol',nickname:'입장대원'})}));assert.equal(response.status,404);assert.equal(r.room.game.state.players.length,0);});

async function lobbyRuntime(){let now=1000000;const source=readFileSync(new URL('../server/worker.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export class ','class ').replace('export default ','globalThis.worker=');const sandbox:any={createServerClock,statePacket,privatePacket,recipientState,createNetworkGame,onlinePlaying,normalizeNickname,captureOfficialResult,createResultOutbox,createIdentityVerifier,Date:{now:()=>now},crypto,URL,Headers,Request,Response,DurableObject:class{ctx:any;env:any;constructor(ctx:any,env:any){this.ctx=ctx;this.env=env;}}};vm.runInNewContext(source+'\nglobalThis.Lobby=Lobby;',sandbox);const values=new Map<string,any>(),requests:string[]=[];const ctx={blockConcurrencyWhile:async(f:()=>unknown)=>f(),storage:{get:async(k:string)=>values.get(k),put:async(k:string,v:any)=>values.set(k,v),delete:async(k:string)=>values.delete(k),setAlarm:async()=>{},list:async({prefix}:any)=>new Map([...values].filter(([k])=>k.startsWith(prefix)))}};const env={ROOMS:{idFromName:(id:string)=>id,get:(id:string)=>({fetch:async()=>{requests.push(id);return Response.json({id:'new-player',token:'token',phase:'playing',mode:'ffa',capacity:20,players:2,accepting:true});}})}};const lobby=new sandbox.Lobby(ctx,env);return {lobby,values,requests,request:(body:any)=>lobby.fetch(new Request('https://lobby/',{method:'POST',body:JSON.stringify(body)}))};}
test('an active room remains joinable by code after lobby metadata expires',async()=>{const r=await lobbyRuntime();r.values.set('room:ABCDEF12',{at:1,ttl:600000});const response=await r.request({action:'join',code:'ABCDEF12',mode:'ffa',map:'harbor'});assert.equal(response.status,200);assert.deepEqual(r.requests,['ABCDEF12']);});
test('quick match keeps offering a non-full live twenty-player room during play',async()=>{const r=await lobbyRuntime();r.values.set('waiting:ffa:harbor',{at:1,code:'ABCDEF12',phase:'playing'});await r.lobby.alarm();const response=await r.request({action:'quick',mode:'ffa',map:'harbor'});assert.equal(response.status,200);assert.equal((await response.json()).code,'ABCDEF12');});

test('a running arena is not closed merely because one participant remains',async()=>{const r=await runtime();r.room.game=createNetworkGame(undefined,'harbor',{mode:'team',waitingRoom:true});r.room.game.join('host');r.room.sessions={host:'host'};const host=await r.connect('host');assert.equal(r.room.game.startMatch('host'),true);r.advance(121000);r.advance(121000);assert.equal(host.closed,false);assert.equal(r.room.game.state.phase,'playing');assert.equal(onlinePlaying(r.room.game.state,'host'),true);});
test('a nameless late guest cannot deploy until a validated nickname is set',async()=>{const r=await runtime();r.room.game=createNetworkGame(undefined,'harbor',{mode:'ffa',waitingRoom:true});r.room.game.join('host');r.room.sessions={host:'host'};await r.connect('host');r.room.game.startMatch('host');const late=r.room.game.join('late','pistol','robot',{nickname:'',guest:true});r.room.sessions.late='late';const socket=await r.connect('late');assert.equal(late.playing,false);socket.handlers.message({data:JSON.stringify({type:'nickname',nickname:'<script>'})});assert.equal(late.playing,false);socket.handlers.message({data:JSON.stringify({type:'nickname',nickname:'검증대원'})});assert.equal(late.playing,true);assert.equal(late.participated,true);assert.ok(late.protection>0);assert.equal(JSON.stringify(r.room.game.checkpoint()).includes('검증대원'),false);});

test('actual room welcome and both broadcast protocols keep team pings private',async()=>{
 const r=await runtime();r.room.game=createNetworkGame(undefined,'harbor',{mode:'team'});
 for(const id of ['a','b','c'])r.room.game.join(id);r.room.sessions={a:'a',b:'b',c:'c'};
 r.room.game.input('a',{seq:1,x:0,y:0,yaw:0,pitch:0,fire:false,shot:false,reload:false,jump:false,sprint:false,scope:false,ping:{kind:'help',x:0,z:0}});r.room.game.step();
 const a=await r.connect('a'),b=await r.connect('b'),c=await r.connect('c');
 assert.equal(a.messages.find((m:any)=>m.type==='welcome').state.pings.length,1);
 assert.equal(b.messages.find((m:any)=>m.type==='welcome').state.pings.length,0);
 assert.equal(c.messages.find((m:any)=>m.type==='welcome').state.pings.length,1);
 r.room.protocols.set(a,2);r.room.broadcast();assert.equal(a.messages.at(-1).ownPings.length,1);assert.equal(a.messages.at(-1).state.pings,undefined);assert.equal(b.messages.at(-1).state.pings.length,0);assert.equal(c.messages.at(-1).state.pings.length,1);
});
