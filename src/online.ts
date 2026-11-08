import { createNetworkTiming } from './network-timing.ts';
import {onlinePlaying,type Command,type MatchState } from './network-game.ts';
export type OnlineSession={code:string;id:string;token:string};
export function createOnlineClient(endpoint:string,onState:(state:MatchState,id:string)=>void,onStatus:(status:string)=>void,onSession:(session:OnlineSession)=>void,getToken:()=>Promise<string|null>=async()=>null){
 let socket:WebSocket|null=null,session:OnlineSession|null=null,stopped=true,retry:ReturnType<typeof setTimeout>|undefined,attempt=0,seq=0,operation=0;
 const timing=createNetworkTiming();
 const url=endpoint.replace(/\/$/,'');
 function connect(){
  if(stopped||!session)return;
  const wsUrl=new URL(`${url}/room/${session.code}`);wsUrl.protocol=wsUrl.protocol==='https:'?'wss:':'ws:';
  const current=new WebSocket(wsUrl);socket=current;
  current.onopen=()=>{if(current!==socket)return;current.send(JSON.stringify({type:'hello',token:session!.token}));};
  current.onmessage=event=>{if(current!==socket)return;try{const message=JSON.parse(event.data);
   if(message.type==='welcome'||message.type==='state'){attempt=0;const state=message.state as MatchState;const me=state.players.find(p=>p.id===session!.id);if(me){seq=Math.max(seq,me.seq+1);timing.received(me.seq);}onState(state,session!.id);onStatus(state.winner?'경기 종료':state.phase==='waiting'?'방장이 경기 시작을 누르면 입장합니다.':onlinePlaying(state,session!.id)?'대전 중':me?.playing===false?'대기방에서 경기 참가를 눌러주세요.':'참가자 연결을 기다리는 중');}
   else if(message.type==='room-error')onStatus(message.reason);
   else if(message.type==='closed'){stopped=true;onStatus('방 연결 종료 · '+message.reason);current.close();}
  }catch{onStatus('서버 메시지를 읽지 못했습니다.');}};
  current.onclose=()=>{if(current!==socket||stopped)return;if(++attempt>5){stopped=true;onStatus('연결을 복구하지 못했습니다. 홈에서 다시 입장해 주세요.');return;}onStatus('연결 복구 중 · 복구될 때까지 조작할 수 없습니다.');retry=setTimeout(connect,Math.min(1000*2**(attempt-1),8000));};
  current.onerror=()=>onStatus('서버 연결을 확인하고 있습니다.');
 }
 return {get available(){return !!url;},get network(){return timing.read();},get connected(){return socket?.readyState===WebSocket.OPEN;},
  async enter(action:'create'|'join'|'quick',code:string,weapon:string,character:string,map='harbor',mode='duel',nickname=''){
   const ticket=++operation;
   if(!url)throw new Error('온라인 서버 연결을 준비 중입니다. 봇 대전과 표적 연습은 바로 이용할 수 있습니다.');
   stopped=true;timing.reset();clearTimeout(retry);socket?.close();socket=null;session=null;onStatus('방 연결 중…');
   const token=await getToken();if(ticket!==operation)return;
   const headers:Record<string,string>={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
   const response=await fetch(url+'/session',{method:'POST',headers,body:JSON.stringify({action,code:action==='join'?code:undefined,weapon,character,map,mode,nickname}),signal:AbortSignal.timeout(10000)});
   const data=await response.json();if(ticket!==operation)return;if(!response.ok)throw new Error(data.error??'방에 입장하지 못했습니다.');session=data;stopped=false;attempt=0;seq=0;onSession(data);connect();
  },
  control(type:'start'|'deploy'|'nickname',nickname?:string){if(stopped||socket?.readyState!==WebSocket.OPEN)return false;socket.send(JSON.stringify({type,nickname}));return true;},
  send(command:Omit<Command,'seq'>){if(!stopped&&socket?.readyState===WebSocket.OPEN&&socket.bufferedAmount<65536){const sent=seq++;timing.sent(sent);socket.send(JSON.stringify({type:'input',command:{...command,seq:sent}}));return sent;}return null;},
  leave(){operation++;stopped=true;clearTimeout(retry);if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'leave'}));socket?.close();socket=null;session=null;},
 };
}
