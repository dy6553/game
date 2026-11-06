import { DurableObject } from 'cloudflare:workers';
import { createNetworkGame } from '../src/network-game.ts';
const json=(body,status=200)=>Response.json(body,{status});
const code=()=>crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();
export class Room extends DurableObject {
 game=createNetworkGame();sessions={};sockets=new Map();timer=null;last=Date.now();disconnectedAt=0;startedAt=0;finishedAt=0;matchStarted=false;packets=new WeakMap();
 constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.env=env;ctx.blockConcurrencyWhile(async()=>{const saved=await ctx.storage.get('checkpoint');if(saved){this.game=createNetworkGame(saved.state);this.sessions=saved.sessions;this.last=saved.last;}});}
 async save(){await this.ctx.storage.put('checkpoint',{state:this.game.state,sessions:this.sessions,last:this.last});}
 async fetch(request){const url=new URL(request.url);
  if(url.pathname==='/reserve')return this.ctx.blockConcurrencyWhile(async()=>{
   if(Date.now()-this.last>120000&&this.sockets.size===0){this.game=createNetworkGame();this.sessions={};}
   if(this.game.state.players.length>=2||this.game.state.winner)return json({error:'입장할 수 없는 방입니다.'},409);
   const input=await request.json(),id=crypto.randomUUID(),token=crypto.randomUUID();
   const p=this.game.join(id,input.weapon,input.character);p.connected=false;this.sessions[token]=id;this.last=Date.now();await this.save();await this.ctx.storage.setAlarm(Date.now()+120000);return json({id,token});
  });
  if(request.headers.get('Upgrade')!=='websocket')return json({error:'WebSocket required'},426);
  const pair=new WebSocketPair(),client=pair[0],server=pair[1];server.accept();
  const timeout=setTimeout(()=>{if(!this.sockets.has(server))server.close(1008,'입장 인증 시간이 지났습니다.');},5000);
  server.addEventListener('message',event=>{
   try{
    if(typeof event.data!=='string'||event.data.length>2048){server.close(1008,'메시지 크기 초과');return;}
    const msg=JSON.parse(event.data);let id=this.sockets.get(server);
    if(!id){if(msg.type!=='hello'||typeof msg.token!=='string'||!this.sessions[msg.token]){server.close(1008,'잘못된 입장 정보');return;}
     id=this.sessions[msg.token];for(const [socket,other] of this.sockets)if(other===id){this.sockets.delete(socket);socket.close(1000,'새 연결로 복귀했습니다.');}
     this.sockets.set(server,id);clearTimeout(timeout);this.game.join(id);this.last=Date.now();this.disconnectedAt=0;
     server.send(JSON.stringify({type:'welcome',id,state:this.game.state}));this.start();return;
    }
    const now=Date.now(),rate=this.packets.get(server)??{at:now,count:0};if(now-rate.at>1000){rate.at=now;rate.count=0;}if(++rate.count>80){server.close(1008,'전송 속도 초과');return;}this.packets.set(server,rate);
    if(msg.type==='input')this.game.input(id,msg.command);
    if(msg.type==='leave'){delete this.sessions[msg.token];this.closeRoom('상대가 방을 나갔습니다.');}
   }catch{server.close(1008,'잘못된 메시지');}
  });
  const close=()=>{clearTimeout(timeout);const id=this.sockets.get(server);this.sockets.delete(server);if(id){this.game.disconnect(id);this.disconnectedAt=Date.now();this.last=Date.now();this.ctx.waitUntil(this.save());}if(!this.sockets.size)this.stop();};
  server.addEventListener('close',close);server.addEventListener('error',close);
  return new Response(null,{status:101,webSocket:client});
 }
 start(){if(this.timer)return;if(!this.startedAt)this.startedAt=Date.now();let ticks=0;this.timer=setInterval(()=>{
  if(this.disconnectedAt&&Date.now()-this.disconnectedAt>30000){this.closeRoom('상대 연결을 복구하지 못해 경기를 종료했습니다.');return;}
  if(this.game.state.winner){if(!this.finishedAt)this.finishedAt=Date.now();if(Date.now()-this.finishedAt>60000){this.closeRoom('경기가 종료되었습니다.');return;}}
  if(!this.matchStarted&&Date.now()-this.startedAt>120000){this.closeRoom('대기 시간이 지나 방을 닫았습니다.');return;}
  if(this.game.state.players.length===2&&this.game.state.players.every(p=>p.connected))this.matchStarted=true;
  this.game.step();this.last=Date.now();const packet=JSON.stringify({type:'state',state:this.game.state});
  for(const socket of this.sockets.keys())try{socket.send(packet);}catch{socket.close();}
  if(++ticks%40===0)this.ctx.waitUntil(this.save());
  if(ticks%1200===0)this.ctx.waitUntil(this.ctx.storage.setAlarm(Date.now()+120000));
 },50);}
 stop(){if(this.timer)clearInterval(this.timer);this.timer=null;}
 closeRoom(reason){for(const socket of this.sockets.keys()){try{socket.send(JSON.stringify({type:'closed',reason}));socket.close(1000,reason);}catch{}}this.sockets.clear();this.stop();this.game=createNetworkGame();this.sessions={};this.startedAt=0;this.finishedAt=0;this.matchStarted=false;this.disconnectedAt=0;this.ctx.waitUntil(this.ctx.storage.deleteAll());}
 async alarm(){if(!this.sockets.size){this.game=createNetworkGame();this.sessions={};await this.ctx.storage.deleteAll();}else await this.ctx.storage.setAlarm(Date.now()+120000);}
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
  const stub=this.env.ROOMS.get(this.env.ROOMS.idFromName(roomCode));
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
 const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST,GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'};
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 const url=new URL(request.url);let response;
 try{
  if(url.pathname==='/session'&&request.method==='POST'){
   const text=await request.text();if(text.length>1024)return json({error:'요청 크기 초과'},413);const body=JSON.parse(text);
   if(!['create','join','quick'].includes(body.action))return json({error:'잘못된 요청'},400);
   response=await env.LOBBY.get(env.LOBBY.idFromName('public')).fetch(new Request('https://lobby/',{method:'POST',body:text,headers:request.headers}));
  }else if(/^\/room\/[0-9A-F]{8}$/.test(url.pathname)&&request.headers.get('Upgrade')==='websocket'){
   return env.ROOMS.get(env.ROOMS.idFromName(url.pathname.split('/')[2])).fetch(request);
  }else response=json({error:'경로를 찾을 수 없습니다.'},404);
 }catch{response=json({error:'서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'},503);}
 const result=new Response(response.body,response);for(const [key,value] of Object.entries(headers))result.headers.set(key,value);return result;
}};
