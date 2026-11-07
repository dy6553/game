export function createNetworkTiming(clock=()=>performance.now()){
 const sent=new Map<number,number>();let rttMs:number|null=null,lastPacket:number|null=null;
 return {
  reset(){sent.clear();rttMs=null;lastPacket=null;},
  sent(seq:number){sent.set(seq,clock());if(sent.size>80)sent.delete(sent.keys().next().value!);},
  received(seq:number){const now=clock();lastPacket=now;const at=sent.get(seq);if(at!==undefined){const sample=Math.max(0,now-at);rttMs=rttMs===null?sample:rttMs*.75+sample*.25;}for(const key of sent.keys())if(key<=seq)sent.delete(key);},
  read(){return {rttMs:rttMs===null?null:Math.round(rttMs),staleMs:lastPacket===null?null:Math.max(0,Math.round(clock()-lastPacket))};},
 };
}
