export function advanceOxygen(oxygen:number,sheltered:boolean,seconds:number){
 if(sheltered)return {oxygen:Math.min(100,oxygen+seconds*12),damage:0};
 const available=oxygen/2;
 return {oxygen:Math.max(0,oxygen-seconds*2),damage:8*Math.max(0,seconds-available)};
}

export function moonEclipse(seconds:number){
 const time=seconds%180,start=85,end=110;
 const warning=time>=start-10&&time<start?Math.ceil(start-time):0;
 const active=time>=start&&time<end;
 const darkness=active?Math.max(0,Math.min(1,(time-start)/4,(end-time)/4)):0;
 return {warning,active,darkness};
}
