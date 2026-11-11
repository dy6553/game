import {renderWeaponSound,mixWeaponSound} from './weapon-audio.ts';
import {isWeaponId,WEAPON_IDS,type WeaponId} from './weapons.ts';
export type Sound='quad'|'bazooka'|'rocket'|'grenade'|'flash'|'heal'|'smg'|'burst'|'dmr'|'pistol'|'machinegun'|'shotgun'|'sniper'|'hit'|'wall'|'step'|'step2'|'land'|'reload'|'ready'|'empty'|'jump'|'hurt'|'death'|'respawn'|'win'|'lose'|'ui'|'scope'|'kill'|'deploy'|'dash'|'pickup'|'equip';
export type AudioSettings={master:number;effects:number;environment:number;muted:boolean};
const samples=['pistol','machinegun','shotgun','sniper','hit','wall','step','step2','land','reload'];
export function spatialSound(x:number,z:number,yaw:number){const distance=Math.hypot(x,z);return {pan:Math.sin(Math.atan2(x,z)-yaw),gain:1/(1+distance*.13)};}
export function createGameAudio(){
 let settings:AudioSettings={master:.7,effects:.85,environment:.16,muted:false};
 try{const saved=JSON.parse(localStorage.getItem('harbor-audio')??'{}');for(const key of ['master','effects','environment'] as const)if(Number.isFinite(saved[key]))settings[key]=Math.max(0,Math.min(1,saved[key]));if(typeof saved.muted==='boolean')settings.muted=saved.muted;}catch{/* Storage is optional. */}
 let ctx:AudioContext|undefined,master:GainNode,fx:GainNode,env:GainNode,menuFx:GainNode,interfaceActive=true,paused=true,loading=false,disposed=false;
 let wind:AudioBufferSourceNode|undefined;const buffers=new Map<string,AudioBuffer>(),voices=new Set<AudioBufferSourceNode>(),interfaceVoices=new Set<AudioBufferSourceNode>();
 const priorities=new Map<AudioBufferSourceNode,number>();
 const priority=(kind:Sound)=>['step','step2','wall'].includes(kind)?0:['hit','kill','hurt','death','win','lose','respawn'].includes(kind)?2:1;
 function stopEffects(){for(const source of voices){try{source.stop();}catch{}}voices.clear();priorities.clear();}
 const apply=()=>{if(!ctx)return;master.gain.setTargetAtTime(settings.muted?0:settings.master,ctx.currentTime,.025);fx.gain.setTargetAtTime(paused?0:settings.effects,ctx.currentTime,.025);env.gain.setTargetAtTime(paused?0:settings.environment*.22,ctx.currentTime,.15);menuFx.gain.setTargetAtTime(interfaceActive?settings.effects:0,ctx.currentTime,.025);};
 function synthetic(kind:Sound){
  if(!ctx)throw new Error('Audio not initialized');
  const key='synth-'+kind,old=buffers.get(key);if(old)return old;
  const gun=['pistol','machinegun','shotgun','sniper','smg','burst','dmr','quad','bazooka'].includes(kind),duration=(kind==='grenade'||kind==='rocket')?.7:kind==='flash'?.3:kind==='heal'?.45:kind==='win'||kind==='lose'?.65:kind==='deploy'?.32:kind==='dash'?.24:kind==='pickup'?.28:gun?.3:.16;
  const b=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=b.getChannelData(0);
  let seed=813,low=0;
  for(let i=0;i<data.length;i++){
   const t=i/ctx.sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/4294967296*2-1;low=low*.9+noise*.1;
   const f=(kind==='grenade'||kind==='rocket')?65:kind==='flash'?1900:kind==='heal'?480+Math.floor(t*8)*120:kind==='deploy'?420*2**(Math.floor(t*10)/5):kind==='win'?440*2**(Math.floor(t*6)/4):kind==='lose'?220-t*160:kind==='pickup'?660*2**(Math.floor(t*14)/4):kind==='equip'?240+900*t:kind==='ready'?880:kind==='respawn'?330+t*1600:kind==='death'?100:kind==='reload'?200:kind==='jump'?260+t*1200:kind==='kill'?950:kind==='hit'?1200:kind==='hurt'?130:kind==='empty'?170:kind==='scope'?1600:620;
   const wave=(kind==='grenade'||kind==='rocket')?low*2+Math.sin(2*Math.PI*f*t)*.35:kind==='flash'?noise*.6:kind==='dash'?(noise-low)*.65:kind==='reload'||kind==='equip'?noise*.3+Math.sin(2*Math.PI*f*t)*.2:gun?(noise*.5+Math.sin(2*Math.PI*((kind==='smg'?150:kind==='dmr'?75:kind==='burst'?115:100)*t-65*t*t))*.4):kind.startsWith('step')||kind==='land'?low*2:Math.sin(2*Math.PI*f*t)*.5+noise*.08;
   data[i]=wave*Math.min(1,t/.003)*Math.exp(-t*((kind==='grenade'||kind==='rocket')?6:kind==='heal'?9:gun?22:kind==='win'||kind==='lose'?4:kind==='dash'||kind==='pickup'?12:30))*.55;
  }
  buffers.set(key,b);return b;
 }
 function soundBuffer(kind:Sound){
  if(!ctx)throw Error('Audio not initialized');
  if(!isWeaponId(kind))return buffers.get(kind)??synthetic(kind);
  const key='weapon-'+kind,cached=buffers.get(key);if(cached)return cached;
  const signature=renderWeaponSound(kind,ctx.sampleRate),sample=buffers.get(kind)?.getChannelData(0);
  const data=mixWeaponSound(signature,sample?.subarray(0,Math.ceil(ctx.sampleRate*.8))),buffer=ctx.createBuffer(1,data.length,ctx.sampleRate);buffer.getChannelData(0).set(data);buffers.set(key,buffer);return buffer;
 }
 async function unlock(){
  if(disposed)return;
  try{
   if(!ctx){
    ctx=new AudioContext({latencyHint:'interactive'});master=ctx.createGain();fx=ctx.createGain();env=ctx.createGain();menuFx=ctx.createGain();const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-16;compressor.ratio.value=5;
    fx.connect(master);env.connect(master);menuFx.connect(master);master.connect(compressor);compressor.connect(ctx.destination);
    const b=ctx.createBuffer(1,ctx.sampleRate*6,ctx.sampleRate),data=b.getChannelData(0);let low=0;
    for(let i=0;i<data.length;i++){low=.985*low+(Math.random()*2-1)*.015;data[i]=low*(.7+.3*Math.cos(i/ctx.sampleRate*2*Math.PI/6));}
    wind=ctx.createBufferSource();wind.buffer=b;wind.loop=true;wind.connect(env);wind.start();apply();for(const id of WEAPON_IDS)soundBuffer(id);
   }
   if(ctx.state!=='running'&&ctx.state!=='closed')await ctx.resume();
   if(!loading&&location.protocol!=='file:'){
    loading=true;const context=ctx;
    void Promise.allSettled(samples.map(async name=>{const response=await fetch(`/audio/${name}.mp3`);if(!response.ok)return;const b=await context.decodeAudioData(await response.arrayBuffer());buffers.set(name,b);buffers.delete('weapon-'+name);if(isWeaponId(name))soundBuffer(name);}));
   }
  }catch{/* Audio restrictions must never stop gameplay. */}
 }
 function play(kind:Sound,pan=0,volume=1){
  if(!ctx||ctx.state!=='running'||paused||settings.muted||settings.master===0||settings.effects===0||disposed)return;
  const rank=priority(kind);
  if(voices.size>=24){const victim=[...voices].find(source=>(priorities.get(source)??0)<rank);if(!victim)return;try{victim.stop();}catch{}voices.delete(victim);priorities.delete(victim);}
  const source=ctx.createBufferSource(),gain=ctx.createGain(),panner=ctx.createStereoPanner();
  source.buffer=soundBuffer(kind);source.playbackRate.value=isWeaponId(kind)?.985+Math.random()*.03:kind.startsWith('step')?.96+Math.random()*.08:1;
  gain.gain.value=Math.max(0,Math.min(1,volume))*(kind==='hit'?.55:kind==='wall'?.3:kind.startsWith('step')?.35:.7);panner.pan.value=Math.max(-1,Math.min(1,pan));
  source.connect(gain);gain.connect(panner);panner.connect(fx);voices.add(source);priorities.set(source,rank);
  source.onended=()=>{voices.delete(source);priorities.delete(source);source.disconnect();gain.disconnect();panner.disconnect();};source.start();
 }
 function stopInterface(){for(const source of interfaceVoices){try{source.stop();}catch{}}interfaceVoices.clear();}
 function playInterface(kind:'ui'|'deploy'|WeaponId,pan=0,delay=0){
  if(!ctx||ctx.state!=='running'||!interfaceActive||settings.muted||settings.master===0||settings.effects===0||disposed||interfaceVoices.size>=4)return;
  const source=ctx.createBufferSource(),panner=ctx.createStereoPanner();source.buffer=soundBuffer(kind);panner.pan.value=pan;source.connect(panner);panner.connect(menuFx);interfaceVoices.add(source);source.onended=()=>{interfaceVoices.delete(source);source.disconnect();panner.disconnect();};source.start(ctx.currentTime+delay);
 }
 return {unlock,play,playInterface,previewWeapon(kind:WeaponId){stopInterface();playInterface(kind);},preview(){playInterface('ui',-.8);playInterface('deploy',.8,.25);},setInterfaceActive(value:boolean){interfaceActive=value;if(!value)stopInterface();apply();},get settings(){return {...settings};},get available(){return !!ctx&&ctx.state==='running';},
  configure(next:Partial<AudioSettings>){if(next.muted){stopEffects();stopInterface();}settings={...settings,...next};for(const key of ['master','effects','environment'] as const)settings[key]=Number.isFinite(settings[key])?Math.max(0,Math.min(1,settings[key])):0;try{localStorage.setItem('harbor-audio',JSON.stringify(settings));}catch{}apply();},
  pause(value:boolean){if(value===paused)return;paused=value;if(value)stopEffects();apply();},
  dispose(){disposed=true;stopInterface();stopEffects();wind?.stop();void ctx?.close();},
 };
}
