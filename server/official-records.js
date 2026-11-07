export function captureOfficialResult(matchId,state,identities,endedAt){
 if(!state.winner||state.players.length!==2||!Number.isSafeInteger(endedAt)||endedAt<0)return null;
 const winner=state.players.find(p=>p.id===state.winner);
 if(!winner||winner.kills!==10||state.players.some(p=>!Number.isInteger(p.kills)||p.kills<0||p.kills>10))return null;
 const users=state.players.map(p=>identities[p.id]).filter(Boolean);
 if(!users.length||new Set(users).size!==users.length)return null;
 return {matchId,endedAt,rows:state.players.filter(p=>identities[p.id]).map(p=>({subject:identities[p.id],outcome:p.id===state.winner?'win':'loss',kills:p.kills,deaths:state.players.find(other=>other.id!==p.id).kills}))};
}
export function publicProfile(profile){return {id:profile.id,played:Number(profile.played),wins:Number(profile.wins),recent:profile.recent.map(r=>({endedAt:Number(r.ended_at),outcome:r.outcome,kills:r.kills,deaths:r.deaths}))};}
// Store separately from the room checkpoint, so closing/reusing a room cannot erase delivery.
const mutations=new WeakMap(),flushes=new WeakMap();
function atomic(storage,action){const previous=mutations.get(storage)??Promise.resolve();const next=previous.catch(()=>{}).then(action);mutations.set(storage,next);return next;}
export function createResultOutbox(storage,write){
 return {
  async enqueue(event){await atomic(storage,async()=>{const pending=await storage.get('official-outbox')??[];if(!pending.some(e=>e.matchId===event.matchId)){pending.push(structuredClone(event));await storage.put('official-outbox',pending);}});},
  async pending(){return (await storage.get('official-outbox')??[]).length>0;},
  async flush(){
   if(flushes.has(storage))return flushes.get(storage);
   const running=(async()=>{
    const events=await storage.get('official-outbox')??[];
    for(const event of events){try{await write(event);}catch{return;}
     await atomic(storage,async()=>{const latest=await storage.get('official-outbox')??[];await storage.put('official-outbox',latest.filter(e=>e.matchId!==event.matchId));});
    }
   })();flushes.set(storage,running);try{await running;}finally{flushes.delete(storage);}
  },
 };
}
