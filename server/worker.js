import {createServerClock} from '../src/server-clock.ts';
import {statePacket,privatePacket} from '../src/network-wire.ts';
import { DurableObject } from 'cloudflare:workers';
import { createNetworkGame,onlinePlaying,normalizeNickname } from '../src/network-game.ts';
import {createIdentityVerifier} from './account-auth.js';
import {captureOfficialResult,createResultOutbox} from './official-records.js';
import {createRecordStore} from './record-store.js';
import {accountHealth} from './account-health.js';
import {deleteOwnAccount} from './account-delete.js';
import {savePlaytest} from './playtest.js';
const json=(body,status=200)=>Response.json(body,{status});
const code=()=>crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();
export class Room extends DurableObject {
 accounts={};matchId=crypto.randomUUID();officialQueued=false;recording=null;closing=null;
 game=createNetworkGame(undefined,'harbor',{clock:()=>Date.now()});sessions={};sockets=new Map();timer=null;last=Date.now();disconnectedAt=0;startedAt=0;finishedAt=0;matchStarted=false;packets=new WeakMap();protocols=new WeakMap();disconnects={};idleSince=0;
 constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.env=env;ctx.blockConcurrencyWhile(async()=>{const saved=await ctx.storage.get('checkpoint');if(saved){this.game=createNetworkGame(saved.state,'harbor',{clock:()=>Date.now()});this.accounts=saved.accounts??{};this.disconnects=saved.disconnects??{};this.idleSince=saved.idleSince??0;this.matchId=saved.matchId??this.matchId;this.officialQueued=saved.officialQueued??false;this.sessions=saved.sessions;this.last=saved.last;this.startedAt=saved.startedAt??saved.last;this.finishedAt=saved.finishedAt??0;this.matchStarted=saved.matchStarted??saved.state.players.length===2;this.disconnectedAt=(this.game.state.mode??'duel')==='duel'&&this.game.state.phase!=='waiting'?(saved.disconnectedAt||saved.last):0;if(this.game.state.mode!=='duel'||this.game.state.phase==='waiting')for(const p of this.game.state.players)if(!p.abandoned)this.disconnects[p.id]??=saved.last;}});}
 async save(){await this.ctx.storage.put('checkpoint',{state:this.game.checkpoint(),disconnects:this.disconnects,idleSince:this.idleSince,accounts:this.accounts,matchId:this.matchId,officialQueued:this.officialQueued,sessions:this.sessions,last:this.last,startedAt:this.startedAt,finishedAt:this.finishedAt,matchStarted:this.matchStarted,disconnectedAt:this.disconnectedAt});}
 outbox(){return createResultOutbox(this.ctx.storage,event=>createRecordStore(this.env).write(event));}
 async queueResult(){
  if(this.recording)return this.recording;if(this.officialQueued)return;
  const event=captureOfficialResult(this.matchId,this.game.state,this.accounts,Date.now());if(!event)return;
  this.recording=(async()=>{await this.outbox().enqueue(event);this.officialQueued=true;await this.save();
   this.ctx.waitUntil(this.deliver());})();
  try{await this.recording;}finally{this.recording=null;}
 }
 async deliver(){await this.outbox().flush();if(await this.outbox().pending())await this.ctx.storage.setAlarm(Date.now()+60000);}
 reset(){this.disconnects={};this.idleSince=0;this.game=createNetworkGame(undefined,'harbor',{clock:()=>Date.now()});this.sessions={};this.accounts={};this.matchId=crypto.randomUUID();this.officialQueued=false;this.startedAt=0;this.finishedAt=0;this.matchStarted=false;this.disconnectedAt=0;}
 async fetch(request){const url=new URL(request.url);
  if(url.pathname==='/reserve')return this.ctx.blockConcurrencyWhile(async()=>{
   if(this.closing)await this.closing;
   if(Date.now()-this.last>120000&&this.sockets.size===0){this.reset();}
   this.expirePlayers();const input=await request.json();
   if(input.action==='join'&&!this.game.state.players.some(p=>!p.abandoned))return json({error:'방이 없거나 경기가 종료되었습니다.'},404);
   if(this.game.state.players.length>=(this.game.state.capacity??2)||this.game.state.winner)return json({error:'입장할 수 없는 방입니다.'},409);
   const id=crypto.randomUUID(),token=crypto.randomUUID();
   const map=this.game.state.players.length?this.game.state.map:(input.map==='factory'?'factory':'harbor');
   if(map==='factory'&&(!input.accountSubject||!(input.accountLevel>=3)))return json({error:'폐공장은 로그인 후 Lv3에 해금됩니다.'},403);
   if(!this.game.state.players.length)this.game=createNetworkGame(undefined,map,{mode:input.mode??'duel',randomPickups:true,waitingRoom:true,clock:()=>Date.now()});
   if(input.accountSubject&&Object.values(this.accounts).includes(input.accountSubject))return json({error:'같은 계정으로 양쪽에 입장할 수 없습니다.'},409);
   const p=this.game.join(id,input.weapon,input.character,{nickname:normalizeNickname(input.nickname)??'대원',guest:!input.accountSubject});if(input.accountSubject)this.accounts[id]=input.accountSubject;p.connected=false;this.disconnects[id]=Date.now();this.sessions[token]=id;this.last=Date.now();await this.save();await this.ctx.storage.setAlarm(Date.now()+120000);return json({id,token,mode:this.game.state.mode,players:this.game.state.players.length,capacity:this.game.state.capacity,phase:this.game.state.phase,accepting:this.game.state.players.length<this.game.state.capacity});
  });
  if(request.headers.get('Upgrade')!=='websocket')return json({error:'WebSocket required'},426);
  const pair=new WebSocketPair(),client=pair[0],server=pair[1];server.accept();
  const timeout=setTimeout(()=>{if(!this.sockets.has(server))server.close(1008,'입장 인증 시간이 지났습니다.');},5000);
  server.addEventListener('message',event=>{
   try{
    if(typeof event.data!=='string'||event.data.length>2048){server.close(1008,'메시지 크기 초과');return;}
    const msg=JSON.parse(event.data);let id=this.sockets.get(server);
    if(!id){this.expirePlayers();if(msg.type!=='hello'||typeof msg.token!=='string'||!this.sessions[msg.token]){server.close(1008,'잘못된 입장 정보');return;}
     if((this.game.state.mode??'duel')==='duel'&&this.disconnectedAt&&Date.now()-this.disconnectedAt>30000){server.close(1008,'재접속 시간이 지났습니다.');this.closeRoom('상대 연결을 복구하지 못해 경기를 종료했습니다.');return;}
     id=this.sessions[msg.token];for(const [socket,other] of this.sockets)if(other===id){this.sockets.delete(socket);socket.close(1000,'새 연결로 복귀했습니다.');}
     this.sockets.set(server,id);this.protocols.set(server,msg.protocol===2?2:1);clearTimeout(timeout);delete this.disconnects[id];this.game.join(id);if(this.game.state.mode!=='duel'&&this.game.state.phase==='playing')this.game.deploy(id);this.last=Date.now();if(this.game.state.players.every(p=>p.connected))this.disconnectedAt=0;
     server.send(JSON.stringify({type:'welcome',id,state:this.game.state}));this.start();return;
    }
    const now=Date.now(),rate=this.packets.get(server)??{at:now,count:0};if(now-rate.at>1000){rate.at=now;rate.count=0;}if(++rate.count>80){server.close(1008,'전송 속도 초과');return;}this.packets.set(server,rate);
    if(msg.type==='start'){if(!this.game.startMatch(id))server.send(JSON.stringify({type:'room-error',reason:'방장만 시작할 수 있습니다. 개인전·팀전은1명부터,1대1은2명부터 시작합니다.'}));else this.matchStarted=true;this.ctx.waitUntil(this.save());this.broadcast();}
    if(msg.type==='deploy'){this.game.deploy(id);this.ctx.waitUntil(this.save());this.broadcast();}
    if(msg.type==='nickname'){if(!this.game.setGuestNickname(id,msg.nickname))server.send(JSON.stringify({type:'room-error',reason:'닉네임을2~16자로 입력하세요.'}));else if(this.game.state.mode!=='duel'&&this.game.state.phase==='playing')this.game.deploy(id);this.broadcast();}
    if(msg.type==='input')this.game.input(id,msg.command);
    if(msg.type==='leave'){if((this.game.state.mode??'duel')==='duel'&&this.game.state.phase!=='waiting')this.closeRoom('상대가 방을 나갔습니다.');else{if(this.game.state.phase==='waiting'){this.game.leaveWaiting(id);delete this.accounts[id];}else this.game.abandon(id);delete this.disconnects[id];for(const token of Object.keys(this.sessions))if(this.sessions[token]===id)delete this.sessions[token];server.send(JSON.stringify({type:'closed',reason:'방을 나왔습니다.'}));server.close(1000,'나가기');this.broadcast();}}

   }catch{server.close(1008,'잘못된 메시지');}
  });
  let socketClosed=false;const close=()=>{if(socketClosed)return;socketClosed=true;try{server.close(1000,'연결 종료');}catch{}clearTimeout(timeout);const id=this.sockets.get(server);this.sockets.delete(server);if(id){this.game.disconnect(id);if((this.game.state.mode??'duel')==='duel'&&this.game.state.phase!=='waiting')this.disconnectedAt ||=Date.now();else if(!this.game.state.players.find(p=>p.id===id)?.abandoned)this.disconnects[id]=Date.now();this.last=Date.now();this.broadcast();this.ctx.waitUntil(Promise.all([this.save(),this.ctx.storage.setAlarm(Date.now()+30000)]));}if(!this.sockets.size)this.stop();};
  server.addEventListener('close',close);server.addEventListener('error',close);
  return new Response(null,{status:101,webSocket:client});
 }
 broadcast(){const compact=statePacket(this.game.state);let legacy;for(const [socket,id] of this.sockets)try{socket.send(this.protocols.get(socket)===2?privatePacket(compact,this.game.state,id):(legacy??=JSON.stringify({type:'state',state:this.game.state})));}catch{}}
 expirePlayers(){for(const [id,at] of Object.entries(this.disconnects))if(Date.now()-at>=30000){if(this.game.state.phase==='waiting'){this.game.leaveWaiting(id);delete this.accounts[id];}else this.game.abandon(id);delete this.disconnects[id];for(const token of Object.keys(this.sessions))if(this.sessions[token]===id)delete this.sessions[token];}}
 start(){if(this.timer)return;if(!this.startedAt)this.startedAt=Date.now();let ticks=0;const clock=createServerClock(Date.now());this.timer=setInterval(()=>{
  if((this.game.state.mode??'duel')==='duel'&&this.disconnectedAt&&Date.now()-this.disconnectedAt>30000){this.closeRoom('상대 연결을 복구하지 못해 경기를 종료했습니다.');return;}
  if(this.game.state.winner){if(!this.finishedAt)this.finishedAt=Date.now();if(Date.now()-this.finishedAt>60000){this.closeRoom('경기가 종료되었습니다.');return;}}
  if(!this.matchStarted&&Date.now()-this.startedAt>((this.game.state.mode??'duel')==='duel'&&!this.game.state.phase?120000:600000)){this.closeRoom('대기 시간이 지나 방을 닫았습니다.');return;}
  this.expirePlayers();if((this.game.state.mode??'duel')==='duel'){if(this.game.state.phase)this.matchStarted=!!this.game.state.started;else if(this.game.state.players.length===2&&this.game.state.players.every(p=>p.connected))this.matchStarted=true;}else{this.expirePlayers();this.matchStarted=!!this.game.state.started;if(this.matchStarted&&!this.game.state.winner&&!onlinePlaying(this.game.state)){this.idleSince ||=Date.now();if(Date.now()-this.idleSince>120000){this.closeRoom('참가 인원이 부족해 경기를 종료했습니다.');return;}}else this.idleSince=0;}
  const steps=clock.steps(Date.now());if(!steps)return;const events=[],toolEvents=[];
  for(let i=0;i<steps;i++){this.game.step();events.push(...this.game.state.events);toolEvents.push(...(this.game.state.toolEvents??[]));}
  this.game.state.events=events;this.game.state.toolEvents=toolEvents;
  if(this.game.state.winner)this.ctx.waitUntil(this.queueResult());this.last=Date.now();this.broadcast();
  if(++ticks%40===0)this.ctx.waitUntil(this.save());
  if(ticks%1200===0&&!this.disconnectedAt)this.ctx.waitUntil(this.ctx.storage.setAlarm(Date.now()+120000));
 },50);}
 stop(){if(this.timer)clearInterval(this.timer);this.timer=null;}
 closeRoom(reason){for(const socket of this.sockets.keys()){try{socket.send(JSON.stringify({type:'closed',reason}));socket.close(1000,reason);}catch{}}this.sockets.clear();this.stop();const cleanup=async()=>{await this.ctx.storage.delete('checkpoint');if(await this.outbox().pending())await this.ctx.storage.setAlarm(Date.now()+60000);};if(!captureOfficialResult(this.matchId,this.game.state,this.accounts,Date.now())){this.reset();this.ctx.waitUntil(cleanup());return;}this.closing=(async()=>{await this.queueResult();this.reset();await cleanup();})().finally(()=>{this.closing=null;});this.ctx.waitUntil(this.closing);}
 async alarm(){await this.deliver();this.expirePlayers();if((this.game.state.mode??'duel')!=='duel'&&!this.sockets.size&&Object.keys(this.disconnects).length){await this.ctx.storage.setAlarm(Math.min(...Object.values(this.disconnects))+30001);return;}if(this.disconnectedAt){this.closeRoom('상대 연결을 복구하지 못해 경기를 종료했습니다.');return;}if(!this.sockets.size){await this.queueResult();this.reset();await this.ctx.storage.delete('checkpoint');if(await this.outbox().pending())await this.ctx.storage.setAlarm(Date.now()+60000);}else await this.ctx.storage.setAlarm(Date.now()+120000);}
}
export class Lobby extends DurableObject {
 rates=new Map();
 async fetch(request){return this.ctx.blockConcurrencyWhile(async()=>{
  const ip=request.headers.get('CF-Connecting-IP')??'local',now=Date.now();for(const [key,v] of this.rates)if(now-v.at>60000)this.rates.delete(key);
  const rate=this.rates.get(ip)??{at:now,count:0};if(++rate.count>60)return json({error:'잠시 후 다시 시도해 주세요.'},429);this.rates.set(ip,rate);
  const body=await request.json();let roomCode=body.code?.toUpperCase();
  if(body.action==='join'&&!/^[0-9A-F]{8}$/.test(roomCode??''))return json({error:'방 코드 8자리를 확인해 주세요.'},400);
  const waitingKey=(body.mode??'duel')==='duel'?(body.map==='factory'?'waiting-factory':'waiting'):`waiting:${body.mode}:${body.map}`;
  if(body.action==='quick'){const pending=await this.ctx.storage.get(waitingKey);if(pending&&((body.mode??'duel')!=='duel'||now-pending.at<(pending.phase==='waiting'?600000:60000)))roomCode=pending.code;await this.ctx.storage.delete(waitingKey);}
  if(!roomCode)roomCode=code();
  const hint=request.headers.get('X-Harbor-Location');
  let stub=this.env.ROOMS.get(this.env.ROOMS.idFromName(roomCode),hint?{locationHint:hint}:undefined);
  // The room validates join-only reservations; live codes outlast lobby discovery metadata.
  let known=await this.ctx.storage.get('room:'+roomCode);
  let reservation=await stub.fetch('https://room/reserve',{method:'POST',body:JSON.stringify(body)});
  if(body.action==='quick'&&reservation.status===409){roomCode=code();known=undefined;stub=this.env.ROOMS.get(this.env.ROOMS.idFromName(roomCode),hint?{locationHint:hint}:undefined);reservation=await stub.fetch('https://room/reserve',{method:'POST',body:JSON.stringify(body)});}
  const session=await reservation.json();if(!reservation.ok)return json(session,reservation.status);
  await this.ctx.storage.put('room:'+roomCode,{at:now,ttl:session.phase?600000:(session.mode??body.mode??'duel')==='duel'?120000:600000});if(body.action==='quick'&&(session.accepting??!known))await this.ctx.storage.put(waitingKey,{code:roomCode,at:now,phase:session.phase});
  await this.ctx.storage.setAlarm(now+180000);return json({...session,code:roomCode});
 });}
 async alarm(){const rooms=await this.ctx.storage.list({prefix:'room:'});for(const [key,at] of rooms)if(Date.now()-(typeof at==='number'?at:at.at)>(at.ttl??120000))await this.ctx.storage.delete(key);await this.ctx.storage.delete('waiting');await this.ctx.storage.delete('waiting-factory');const waiting=await this.ctx.storage.list({prefix:'waiting:'});for(const [key,v] of waiting)if(!/^waiting:(ffa|team):(harbor|factory)$/.test(key)&&Date.now()-v.at>600000)await this.ctx.storage.delete(key);}
}
export default {async fetch(request,env){
 const origin=request.headers.get('Origin'),allowed=env.ALLOWED_ORIGINS.split(',');
 if(!origin||!allowed.includes(origin))return json({error:'허용되지 않은 접속 주소'},403);
 const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST,GET,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization','Vary':'Origin','Cache-Control':'no-store','X-Harbor-Version':'dash-v1','X-Harbor-Accounts':env.ACCOUNTS_ENABLED==='true'?'enabled-v1':'pending-v1'};
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 const url=new URL(request.url);let response;
 try{
  if(url.pathname==='/playtest'){
   response=await savePlaytest(request,env.PLAYTEST_LOGS);
  }else if(url.pathname==='/health/accounts'&&request.method==='GET'){
   response=json(await accountHealth(env));
  }else if(url.pathname==='/session'&&request.method==='POST'){
   const text=await request.text();if(text.length>1024)throw Error('Request too large');const body=JSON.parse(text);
   if(!['create','join','quick'].includes(body.action))return json({error:'잘못된 요청'},400);
   let subject;try{subject=await createIdentityVerifier(env)(request);}catch{response=json({error:'로그인이 만료되었거나 올바르지 않습니다. 다시 로그인하세요.'},401);}
   if(response){const result=new Response(response.body,response);for(const [key,value] of Object.entries(headers))result.headers.set(key,value);return result;}
   delete body.accountSubject;delete body.userId;delete body.accountLevel;
   body.map=body.map==='factory'?'factory':'harbor';body.mode=['duel','ffa','team'].includes(body.mode)?body.mode:'duel';
   if(subject){if(env.ACCOUNTS_ENABLED!=='true')throw Error('Accounts not ready');const profile=await createRecordStore(env).account(subject);body.nickname=profile.nickname;body.accountSubject=subject;body.accountLevel=(await createRecordStore(env).progression(subject)).level;}
   if(body.action!=='join'&&body.map==='factory'&&(!subject||body.accountLevel<3)){const denied=json({error:'폐공장은 로그인 후 Lv3에 해금됩니다.'},403);for(const [key,value] of Object.entries(headers))denied.headers.set(key,value);return denied;}
   if(body.character==='welder'&&(!subject||body.accountLevel<3)){
    const denied=json({error:'용접 로봇은 로그인 후 Lv3에 해금됩니다.'},403);for(const [key,value] of Object.entries(headers))denied.headers.set(key,value);return denied;
   }
   body.nickname=normalizeNickname(body.nickname);if(!body.nickname){const denied=json({error:'온라인 입장 전에 닉네임을2~16자로 설정하세요.'},400);for(const [k,v] of Object.entries(headers))denied.headers.set(k,v);return denied;}
   const forwarded=new Headers(request.headers);forwarded.delete('Authorization');forwarded.delete('X-Harbor-Location');
   const hints={AS:'apac',OC:'oc',NA:'wnam',SA:'sam',EU:'weur',AF:'afr'};const hint=hints[request.cf?.continent];if(hint)forwarded.set('X-Harbor-Location',hint);
   response=await env.LOBBY.get(env.LOBBY.idFromName('public')).fetch(new Request('https://lobby/',{method:'POST',body:JSON.stringify(body),headers:forwarded}));
  }else if(url.pathname==='/account/nickname'&&request.method==='POST'){
   if(env.ACCOUNTS_ENABLED!=='true')throw Error('Accounts not ready');let subject;try{subject=await createIdentityVerifier(env)(request);}catch{}if(!subject)response=json({error:'로그인이 필요합니다.'},401);else{const text=await request.text();if(text.length>256)response=json({error:'닉네임이 너무 깁니다.'},400);else{const name=normalizeNickname(JSON.parse(text).nickname);response=name?json(await createRecordStore(env).setNickname(subject,name)):json({error:'닉네임은2~16자 한글·영문·숫자·공백·_-로 입력하세요.'},400);}}
  }else if(['/admin/players/find','/admin/players/level'].includes(url.pathname)&&request.method==='POST'){
   if(env.ACCOUNTS_ENABLED!=='true')throw Error('Accounts not ready');
   let subject;try{subject=await createIdentityVerifier(env)(request);}catch{}
   if(!subject)response=json({error:'로그인이 필요합니다.'},401);
   else {
    const store=createRecordStore(env);
    if(!await store.isAdmin(subject))response=json({error:'관리자 권한이 필요합니다.'},403);
    else {const raw=await request.text();if(raw.length>2048)response=json({error:'입력 내용을 확인하세요.'},400);
     else {let body;try{body=JSON.parse(raw);}catch{response=json({error:'입력 내용을 확인하세요.'},400);}
      if(!response)try{response=json(url.pathname.endsWith('/find')?await store.adminFind(subject,body?.email):await store.adminEdit(subject,body));}
      catch(error){const messages={400:'입력 내용을 확인하세요.',403:'관리자 권한이 필요합니다.',404:'계정을 찾지 못했습니다. 해당 계정으로 게임에 먼저 로그인했는지 확인하세요.',409:'경험치가 변경되었거나 요청이 충돌했습니다. 계정을 다시 조회한 뒤 저장하세요.'};if(messages[error.status])response=json({error:messages[error.status]},error.status);else throw error;}
     }
    }
   }
  }else if((url.pathname==='/growth/start'||/^\/growth\/finish\/[0-9a-f-]{36}$/i.test(url.pathname))&&request.method==='POST'){
   if(env.ACCOUNTS_ENABLED!=='true')throw Error('Accounts not ready');
   let subject;try{subject=await createIdentityVerifier(env)(request);}catch{}
   if(!subject)response=json({error:'로그인이 필요합니다.'},401);
   else {const raw=await request.text();if(raw.length>2048)response=json({error:'잘못된 요청'},400);
    else {const body=JSON.parse(raw),store=createRecordStore(env);try{response=json(url.pathname==='/growth/start'?await store.startRun(subject,body):await store.finishRun(subject,url.pathname.split('/')[3],body));}catch(error){if(error.message.startsWith('Invalid'))response=json({error:'잘못된 경기 결과'},400);else throw error;}}
   }
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
