import { DurableObject } from 'cloudflare:workers';
import { createNetworkGame } from '../src/network-game.ts';
import {createIdentityVerifier} from './account-auth.js';
import {captureOfficialResult,createResultOutbox} from './official-records.js';
import {createRecordStore} from './record-store.js';
import {accountHealth} from './account-health.js';
import {deleteOwnAccount} from './account-delete.js';
import {runApprovedCleanup} from './approved-cleanup.js';
const json=(body,status=200)=>Response.json(body,{status});
const code=()=>crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();
export class Room extends DurableObject {
 accounts={};matchId=crypto.randomUUID();officialQueued=false;recording=null;closing=null;
 game=createNetworkGame();sessions={};sockets=new Map();timer=null;last=Date.now();disconnectedAt=0;startedAt=0;finishedAt=0;matchStarted=false;packets=new WeakMap();
 constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.env=env;ctx.blockConcurrencyWhile(async()=>{const saved=await ctx.storage.get('checkpoint');if(saved){this.game=createNetworkGame(saved.state);this.accounts=saved.accounts??{};this.matchId=saved.matchId??this.matchId;this.officialQueued=saved.officialQueued??false;this.sessions=saved.sessions;this.last=saved.last;this.startedAt=saved.startedAt??saved.last;this.finishedAt=saved.finishedAt??0;this.matchStarted=saved.matchStarted??saved.state.players.length===2;this.disconnectedAt=saved.disconnectedAt||saved.last;}});}
 async save(){await this.ctx.storage.put('checkpoint',{state:this.game.state,accounts:this.accounts,matchId:this.matchId,officialQueued:this.officialQueued,sessions:this.sessions,last:this.last,startedAt:this.startedAt,finishedAt:this.finishedAt,matchStarted:this.matchStarted,disconnectedAt:this.disconnectedAt});}
 outbox(){return createResultOutbox(this.ctx.storage,event=>createRecordStore(this.env).write(event));}
 async queueResult(){
  if(this.recording)return this.recording;if(this.officialQueued)return;
  const event=captureOfficialResult(this.matchId,this.game.state,this.accounts,Date.now());if(!event)return;
  this.recording=(async()=>{await this.outbox().enqueue(event);this.officialQueued=true;await this.save();
   this.ctx.waitUntil(this.deliver());})();
  try{await this.recording;}finally{this.recording=null;}
 }
 async deliver(){await this.outbox().flush();if(await this.outbox().pending())await this.ctx.storage.setAlarm(Date.now()+60000);}
 reset(){this.game=createNetworkGame();this.sessions={};this.accounts={};this.matchId=crypto.randomUUID();this.officialQueued=false;this.startedAt=0;this.finishedAt=0;this.matchStarted=false;this.disconnectedAt=0;}
 async fetch(request){const url=new URL(request.url);
  if(url.pathname==='/reserve')return this.ctx.blockConcurrencyWhile(async()=>{
   if(this.closing)await this.closing;
   if(Date.now()-this.last>120000&&this.sockets.size===0){this.reset();}
   if(this.game.state.players.length>=2||this.game.state.winner)return json({error:'입장할 수 없는 방입니다.'},409);
   const input=await request.json(),id=crypto.randomUUID(),token=crypto.randomUUID();
   if(input.accountSubject&&Object.values(this.accounts).includes(input.accountSubject))return json({error:'같은 계정으로 양쪽에 입장할 수 없습니다.'},409);
   const p=this.game.join(id,input.weapon,input.character);if(input.accountSubject)this.accounts[id]=input.accountSubject;p.connected=false;this.sessions[token]=id;this.last=Date.now();await this.save();await this.ctx.storage.setAlarm(Date.now()+120000);return json({id,token});
  });
  if(request.headers.get('Upgrade')!=='websocket')return json({error:'WebSocket required'},426);
  const pair=new WebSocketPair(),client=pair[0],server=pair[1];server.accept();
  const timeout=setTimeout(()=>{if(!this.sockets.has(server))server.close(1008,'입장 인증 시간이 지났습니다.');},5000);
  server.addEventListener('message',event=>{
   try{
    if(typeof event.data!=='string'||event.data.length>2048){server.close(1008,'메시지 크기 초과');return;}
    const msg=JSON.parse(event.data);let id=this.sockets.get(server);
    if(!id){if(msg.type!=='hello'||typeof msg.token!=='string'||!this.sessions[msg.token]){server.close(1008,'잘못된 입장 정보');return;}
     if(this.disconnectedAt&&Date.now()-this.disconnectedAt>30000){server.close(1008,'재접속 시간이 지났습니다.');this.closeRoom('상대 연결을 복구하지 못해 경기를 종료했습니다.');return;}
     id=this.sessions[msg.token];for(const [socket,other] of this.sockets)if(other===id){this.sockets.delete(socket);socket.close(1000,'새 연결로 복귀했습니다.');}
     this.sockets.set(server,id);clearTimeout(timeout);this.game.join(id);this.last=Date.now();if(this.game.state.players.every(p=>p.connected))this.disconnectedAt=0;
     server.send(JSON.stringify({type:'welcome',id,state:this.game.state}));this.start();return;
    }
    const now=Date.now(),rate=this.packets.get(server)??{at:now,count:0};if(now-rate.at>1000){rate.at=now;rate.count=0;}if(++rate.count>80){server.close(1008,'전송 속도 초과');return;}this.packets.set(server,rate);
    if(msg.type==='input')this.game.input(id,msg.command);
    if(msg.type==='leave'){this.closeRoom('상대가 방을 나갔습니다.');}
   }catch{server.close(1008,'잘못된 메시지');}
  });
  const close=()=>{clearTimeout(timeout);const id=this.sockets.get(server);this.sockets.delete(server);if(id){this.game.disconnect(id);this.disconnectedAt ||=Date.now();this.last=Date.now();this.ctx.waitUntil(Promise.all([this.save(),this.ctx.storage.setAlarm(this.disconnectedAt+30000)]));}if(!this.sockets.size)this.stop();};
  server.addEventListener('close',close);server.addEventListener('error',close);
  return new Response(null,{status:101,webSocket:client});
 }
 start(){if(this.timer)return;if(!this.startedAt)this.startedAt=Date.now();let ticks=0;this.timer=setInterval(()=>{
  if(this.disconnectedAt&&Date.now()-this.disconnectedAt>30000){this.closeRoom('상대 연결을 복구하지 못해 경기를 종료했습니다.');return;}
  if(this.game.state.winner){if(!this.finishedAt)this.finishedAt=Date.now();if(Date.now()-this.finishedAt>60000){this.closeRoom('경기가 종료되었습니다.');return;}}
  if(!this.matchStarted&&Date.now()-this.startedAt>120000){this.closeRoom('대기 시간이 지나 방을 닫았습니다.');return;}
  if(this.game.state.players.length===2&&this.game.state.players.every(p=>p.connected))this.matchStarted=true;
  this.game.step();if(this.game.state.winner)this.ctx.waitUntil(this.queueResult());this.last=Date.now();const packet=JSON.stringify({type:'state',state:this.game.state});
  for(const socket of this.sockets.keys())try{socket.send(packet);}catch{socket.close();}
  if(++ticks%40===0)this.ctx.waitUntil(this.save());
  if(ticks%1200===0&&!this.disconnectedAt)this.ctx.waitUntil(this.ctx.storage.setAlarm(Date.now()+120000));
 },50);}
 stop(){if(this.timer)clearInterval(this.timer);this.timer=null;}
 closeRoom(reason){for(const socket of this.sockets.keys()){try{socket.send(JSON.stringify({type:'closed',reason}));socket.close(1000,reason);}catch{}}this.sockets.clear();this.stop();const cleanup=async()=>{await this.ctx.storage.delete('checkpoint');if(await this.outbox().pending())await this.ctx.storage.setAlarm(Date.now()+60000);};if(!captureOfficialResult(this.matchId,this.game.state,this.accounts,Date.now())){this.reset();this.ctx.waitUntil(cleanup());return;}this.closing=(async()=>{await this.queueResult();this.reset();await cleanup();})().finally(()=>{this.closing=null;});this.ctx.waitUntil(this.closing);}
 async alarm(){await this.deliver();if(this.disconnectedAt){this.closeRoom('상대 연결을 복구하지 못해 경기를 종료했습니다.');return;}if(!this.sockets.size){await this.queueResult();this.reset();await this.ctx.storage.delete('checkpoint');if(await this.outbox().pending())await this.ctx.storage.setAlarm(Date.now()+60000);}else await this.ctx.storage.setAlarm(Date.now()+120000);}
}
export class Lobby extends DurableObject {
 rates=new Map();
 async fetch(request){return this.ctx.blockConcurrencyWhile(async()=>{
  const ip=request.headers.get('CF-Connecting-IP')??'local',now=Date.now();for(const [key,v] of this.rates)if(now-v.at>60000)this.rates.delete(key);
  const rate=this.rates.get(ip)??{at:now,count:0};if(++rate.count>12)return json({error:'잠시 후 다시 시도해 주세요.'},429);this.rates.set(ip,rate);
  const body=await request.json();let roomCode=body.code?.toUpperCase();
  if(body.action==='join'&&!/^[0-9A-F]{8}$/.test(roomCode??''))return json({error:'방 코드 8자리를 확인해 주세요.'},400);
  if(body.action==='quick'){const pending=await this.ctx.storage.get('waiting');if(pending&&now-pending.at<60000)roomCode=pending.code;await this.ctx.storage.delete('waiting');}
  if(!roomCode)roomCode=code();
  const hint=request.headers.get('X-Harbor-Location');
  const stub=this.env.ROOMS.get(this.env.ROOMS.idFromName(roomCode),hint?{locationHint:hint}:undefined);
  // Joining must never silently create a room for a mistyped code.
  const known=await this.ctx.storage.get('room:'+roomCode);
  if(body.action==='join'&&(!known||now-known>120000))return json({error:'방이 없거나 입장 시간이 지났습니다.'},404);
  const reservation=await stub.fetch('https://room/reserve',{method:'POST',body:JSON.stringify(body)});
  const session=await reservation.json();if(!reservation.ok)return json(session,reservation.status);
  if(!known){await this.ctx.storage.put('room:'+roomCode,now);if(body.action==='quick')await this.ctx.storage.put('waiting',{code:roomCode,at:now});}
  await this.ctx.storage.setAlarm(now+180000);return json({...session,code:roomCode});
 });}
 async alarm(){const rooms=await this.ctx.storage.list({prefix:'room:'});for(const [key,at] of rooms)if(Date.now()-at>120000)await this.ctx.storage.delete(key);await this.ctx.storage.delete('waiting');}
}
export default {async fetch(request,env){
 const origin=request.headers.get('Origin'),allowed=env.ALLOWED_ORIGINS.split(',');
 if(!origin||!allowed.includes(origin))return json({error:'허용되지 않은 접속 주소'},403);
 const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST,GET,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization','Vary':'Origin','Cache-Control':'no-store','X-Harbor-Version':'dash-v1','X-Harbor-Accounts':env.ACCOUNTS_ENABLED==='true'?'enabled-v1':'pending-v1'};
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 const url=new URL(request.url);let response;
 try{
  if(url.pathname==='/maintenance/approved-test-cleanup'&&request.method==='POST'){
   response=await runApprovedCleanup(request,env);
  }else if(url.pathname==='/health/accounts'&&request.method==='GET'){
   response=json(await accountHealth(env));
  }else if(url.pathname==='/session'&&request.method==='POST'){
   const text=await request.text();if(text.length>1024)throw Error('Request too large');const body=JSON.parse(text);
   if(!['create','join','quick'].includes(body.action))return json({error:'잘못된 요청'},400);
   let subject;try{subject=await createIdentityVerifier(env)(request);}catch{response=json({error:'로그인이 만료되었거나 올바르지 않습니다. 다시 로그인하세요.'},401);}
   if(response){const result=new Response(response.body,response);for(const [key,value] of Object.entries(headers))result.headers.set(key,value);return result;}
   delete body.accountSubject;delete body.userId;
   if(subject){if(env.ACCOUNTS_ENABLED!=='true')throw Error('Accounts not ready');await createRecordStore(env).account(subject);body.accountSubject=subject;}
   const forwarded=new Headers(request.headers);forwarded.delete('Authorization');forwarded.delete('X-Harbor-Location');
   const hints={AS:'apac',OC:'oc',NA:'wnam',SA:'sam',EU:'weur',AF:'afr'};const hint=hints[request.cf?.continent];if(hint)forwarded.set('X-Harbor-Location',hint);
   response=await env.LOBBY.get(env.LOBBY.idFromName('public')).fetch(new Request('https://lobby/',{method:'POST',body:JSON.stringify(body),headers:forwarded}));
  }else if(url.pathname==='/account'&&request.method==='DELETE'){
   if(env.ACCOUNTS_ENABLED!=='true')throw Error('Accounts not ready');
   let subject;try{subject=await createIdentityVerifier(env)(request);}catch{}
   response=subject?await deleteOwnAccount(request,env,subject,createRecordStore(env)):json({error:'로그인이 필요합니다.'},401);
  }else if(url.pathname==='/account'&&request.method==='GET'){
   if(env.ACCOUNTS_ENABLED!=='true')throw Error('Accounts not ready');
   let subject;try{subject=await createIdentityVerifier(env)(request);}catch{}
   response=subject?json(await createRecordStore(env).account(subject)):json({error:'로그인이 필요합니다.'},401);
  }else if(/^\/profiles\/[0-9a-f-]{36}$/i.test(url.pathname)&&request.method==='GET'){
   if(env.ACCOUNTS_ENABLED!=='true')throw Error('Accounts not ready');
   const profile=await createRecordStore(env).profile(url.pathname.split('/')[2]);response=profile?json(profile):json({error:'전적을 찾을 수 없습니다.'},404);
  }else if(/^\/room\/[0-9A-F]{8}$/.test(url.pathname)&&request.headers.get('Upgrade')==='websocket'){
   return env.ROOMS.get(env.ROOMS.idFromName(url.pathname.split('/')[2])).fetch(request);
  }else response=json({error:'경로를 찾을 수 없습니다.'},404);
 }catch{response=json({error:'서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'},503);}
 const result=new Response(response.body,response);for(const [key,value] of Object.entries(headers))result.headers.set(key,value);return result;
}};
