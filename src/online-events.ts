// Snapshots may arrive several times between draws. Keep transient events apart
// from the newest authoritative state; the queue is bounded during long stalls.
export function createOnlineEvents<T extends {id:number}>(capacity=512){
 let latest=-1,events:T[]=[];
 return {
  receive(incoming:readonly T[]){
   for(const event of incoming)if(event.id>latest){latest=event.id;events.push(event);}
   if(events.length>capacity)events.splice(0,events.length-capacity);
  },
  drain(){const result=events;events=[];return result;},
  reset(){latest=-1;events=[];},
 };
}
