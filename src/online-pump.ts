export function createOnlinePump(send:()=>void,clock=()=>performance.now()){
 let last=-Infinity;
 return {pump(urgent=false){const now=clock();if(now-last<(urgent?16:50)-.01)return false;last=now;send();return true;}};
}
