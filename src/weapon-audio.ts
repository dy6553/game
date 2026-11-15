import type {WeaponId} from './weapons.ts';
// One cached mono buffer per gun. No oscillators or filters are allocated per shot.
const profiles:Record<WeaponId,{duration:number;body:number;decay:number;noise:number;metal:number;tail:number}>={
 pistol:{duration:.27,body:145,decay:28,noise:.58,metal:1900,tail:.05},
 machinegun:{duration:.19,body:118,decay:34,noise:.7,metal:2400,tail:.025},
 smg:{duration:.15,body:195,decay:43,noise:.78,metal:3100,tail:.018},
 burst:{duration:.23,body:132,decay:31,noise:.63,metal:2250,tail:.045},
 quad:{duration:.25,body:103,decay:29,noise:.67,metal:2050,tail:.055},
 dmr:{duration:.37,body:88,decay:20,noise:.55,metal:1600,tail:.095},
 shotgun:{duration:.45,body:68,decay:16,noise:.85,metal:1150,tail:.14},
 sniper:{duration:.55,body:57,decay:14,noise:.68,metal:1380,tail:.17},
 bazooka:{duration:.62,body:42,decay:10,noise:.4,metal:620,tail:.24},
};
export function renderWeaponSound(weapon:WeaponId,sampleRate:number){
 const p=profiles[weapon],data=new Float32Array(Math.ceil(sampleRate*p.duration));let seed=weapon.split('').reduce((n,c)=>n+c.charCodeAt(0),713),low=0,peak=0;
 for(let i=0;i<data.length;i++){
  const t=i/sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/4294967296*2-1;low=.82*low+.18*noise;
  const attack=Math.min(1,t/.0015),fade=Math.min(1,(data.length-1-i)/(sampleRate*.018));
  const body=Math.sin(2*Math.PI*p.body*(t-.38*t*t))*Math.exp(-t*p.decay);
  const crack=(noise-low*.45)*p.noise*Math.exp(-t*(p.decay+18));
  const mechanical=t>.035?Math.sin(2*Math.PI*p.metal*t)*Math.exp(-(t-.035)*95)*.08:0;
  const tail=low*p.tail*Math.exp(-t*9);
  data[i]=(body*.55+crack+mechanical+tail)*attack*Math.max(0,fade);peak=Math.max(peak,Math.abs(data[i]!));
 }
 if(peak>0)for(let i=0;i<data.length;i++)data[i]=data[i]!*.72/peak;
 return data;
}
export function mixWeaponSound(signature:Float32Array,source?:Float32Array){
 if(!source)return signature;
 const data=new Float32Array(Math.max(signature.length,source.length));let peak=0;
 for(let i=0;i<data.length;i++){data[i]=((source[i]??0)*.72+(signature[i]??0)*.32)*Math.min(1,(data.length-1-i)/160);peak=Math.max(peak,Math.abs(data[i]!));}
 if(peak>.82)for(let i=0;i<data.length;i++)data[i]=data[i]!*.82/peak;
 return data;
}
