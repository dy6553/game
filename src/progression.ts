export function growth(value:number){
 const xp=Number.isSafeInteger(value)&&value>=0?value:0,level=1+Math.floor(xp/200);
 return {xp,level,tier:level>=6?3:level>=4?2:level>=2?1:0,within:xp%200};
}
export type Growth=ReturnType<typeof growth>;
export function reward(r:{outcome:string;kills:number;mode:string;wave?:number|null;totalWaves?:number|null}){
 if(!['duel','ffa','survival','online'].includes(r.mode)||!['win','loss'].includes(r.outcome)||!Number.isSafeInteger(r.kills)||r.kills<0)return 0;
 const waves=r.mode==='survival'?Math.max(0,Math.min(30,r.outcome==='win'?(r.totalWaves??0):(r.wave??1)-1)):0;
 return (r.outcome==='win'?100:50)+Math.min(10,r.kills)*10+waves*20;
}
