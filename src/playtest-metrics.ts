export type PlaytestMode='online'|'bot'|'practice';
const percentile=(values:number[],q:number)=>{const s=[...values].sort((a,b)=>a-b);return s.length?s[Math.max(0,Math.ceil(s.length*q)-1)]!:null;};
const round=(n:number|null)=>n===null?null:Math.round(n*10)/10;
export function createPlaytestWindow(){
 let frames:number[]=[],rtts:number[]=[],gaps:number[]=[],corrections:number[]=[],seconds=0;
 return {
  frame(dt:number){if(Number.isFinite(dt)&&dt>0&&dt<=10&&frames.length<8192){frames.push(dt*1000);seconds+=dt;}},
  network(rtt:number|null){if(rtt!==null&&Number.isFinite(rtt)&&rtt>=0&&rtt<=60000&&rtts.length<512)rtts.push(rtt);},
  gap(ms:number){if(Number.isFinite(ms)&&ms>=0&&ms<=60000&&gaps.length<1024)gaps.push(ms);},
  correction(m:number){if(Number.isFinite(m)&&m>=0&&m<=200&&corrections.length<1024)corrections.push(m);},
  read(){return {seconds:round(seconds),frames:frames.length,fps:round(seconds?frames.length/seconds:0),frameP95Ms:round(percentile(frames,.95)),stalls:frames.filter(n=>n>50).length,rttSamples:rtts.length,rttP50Ms:round(percentile(rtts,.5)),rttP95Ms:round(percentile(rtts,.95)),rttMaxMs:round(rtts.length?Math.max(...rtts):null),gapSamples:gaps.length,gapP95Ms:round(percentile(gaps,.95)),gapMaxMs:round(gaps.length?Math.max(...gaps):null),corrections:corrections.length,correctionP95M:round(percentile(corrections,.95))};},
 };
}
