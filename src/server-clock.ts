/** Fixed50ms simulation, bounded catch-up: no one can gain time by sending more packets. */
export function createServerClock(at:number){
 let previous=at,debt=0;
 return {steps(now:number){if(!Number.isFinite(now)||now<previous)return 0;debt+=Math.min(250,now-previous);previous=now;const count=Math.min(5,Math.floor((debt+1e-6)/50));debt-=count*50;return count;}};
}
