export type Sound='pistol'|'machinegun'|'shotgun'|'sniper'|'hit'|'wall'|'step'|'step2'|'land'|'reload'|'ready'|'empty'|'jump'|'hurt'|'death'|'respawn'|'win'|'lose'|'ui'|'scope'|'kill';
export type AudioSettings={master:number;effects:number;environment:number;muted:boolean};
const samples=['pistol','machinegun','shotgun','sniper','hit','wall','step','step2','land','reload'];
export function spatialSound(x:number,z:number,yaw:number){const distance=Math.hypot(x,z);return {pan:Math.sin(Math.atan2(x,z)-yaw),gain:1/(1+distance*.13)};}
export function createGameAudio(){
 let settings:AudioSettings={master:.7,effects:.85,environment:.16,muted:false};
 try{const saved=JSON.parse(localStorage.getItem('harbor-audio')??'{}');for(const key of ['master','effects','environment'] as const)if(Number.isFinite(saved[key]))settings[key]=Math.max(0,Math.min(1,saved[key]));if(typeof saved.muted==='boolean')settings.muted=saved.muted;}catch{/* Storage is optional. */}
 let ctx:AudioContext|undefined,master:GainNode,fx:GainNode,env:GainNode,paused=true,loading=false;
 let wind:AudioBufferSourceNode|undefined;const buffers=new Map<string,AudioBuffer>(),voices=new Set<AudioBufferSourceNode>();
 const apply=()=>{if(!ctx)return;master.gain.setTargetAtTime(settings.muted?0:settings.master,ctx.currentTime,.025);fx.gain.setTargetAtTime(paused?0:settings.effects,ctx.currentTime,.025);env.gain.setTargetAtTime(paused?0:settings.environment*.22,ctx.currentTime,.15);};
 function synthetic(kind:Sound){
  if(!ctx)throw new Error('Audio not initialized');
  const key='synth-'+kind,old=buffers.get(key);if(old)return old;
  const gun=['pistol','machinegun','shotgun','sniper'].includes(kind),duration=kind==='win'||kind==='lose'?.65:gun?.3:.16;
  const b=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=b.getChannelData(0);
  let seed=813,low=0;
  for(let i=0;i<data.length;i++){
   const t=i/ctx.sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/4294967296*2-1;low=low*.9+noise*.1;
   const f=kind==='win'?440*2**(Math.floor(t*6)/4):kind==='lose'?220-t*160:kind==='kill'?950:kind==='hit'?1200:kind==='hurt'?130:kind==='empty'?170:kind==='scope'?1600:620;
   const wave=gun?(noise*.5+Math.sin(2*Math.PI*(100*t-65*t*t))*.4):kind.startsWith('step')||kind==='land'?low*2:Math.sin(2*Math.PI*f*t)*.5+noise*.08;
   data[i]=wave*Math.min(1,t/.003)*Math.exp(-t*(gun?22:kind==='win'||kind==='lose'?4:30))*.55;
  }
  buffers.set(key,b);return b;
 }
 async function unlock(){
  try{
   if(!ctx){
    ctx=new AudioContext();master=ctx.createGain();fx=ctx.createGain();env=ctx.createGain();const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-16;compressor.ratio.value=5;
    fx.connect(master);env.connect(master);master.connect(compressor);compressor.connect(ctx.destination);
    const b=ctx.createBuffer(1,ctx.sampleRate*6,ctx.sampleRate),data=b.getChannelData(0);let low=0;
    for(let i=0;i<data.length;i++){low=.985*low+(Math.random()*2-1)*.015;data[i]=low*(.7+.3*Math.cos(i/ctx.sampleRate*2*Math.PI/6));}
    wind=ctx.createBufferSource();wind.buffer=b;wind.loop=true;wind.connect(env);wind.start();apply();
   }
   if(ctx.state==='suspended')await ctx.resume();
   if(!loading&&location.protocol!=='file:'){
    loading=true;const context=ctx;
    void Promise.allSettled(samples.map(async name=>{const response=await fetch(`/audio/${name}.mp3`);if(!response.ok)return;const b=await context.decodeAudioData(await response.arrayBuffer());buffers.set(name,b);}));
   }
  }catch{/* Audio restrictions must never stop gameplay. */}
 }
 function play(kind:Sound,pan=0,volume=1){
  if(!ctx||ctx.state!=='running'||paused||settings.muted||voices.size>=24)return;
  const source=ctx.createBufferSource(),gain=ctx.createGain(),panner=ctx.createStereoPanner();
  source.buffer=buffers.get(kind)??synthetic(kind);source.playbackRate.value=kind==='machinegun'||kind.startsWith('step')?.96+Math.random()*.08:1;
  gain.gain.value=Math.max(0,Math.min(1,volume))*(kind==='hit'?.55:kind==='wall'?.3:kind.startsWith('step')?.35:.7);panner.pan.value=Math.max(-1,Math.min(1,pan));
  source.connect(gain);gain.connect(panner);panner.connect(fx);voices.add(source);
  source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect();panner.disconnect();};source.start();
 }
 return {unlock,play,get settings(){return {...settings};},get available(){return !!ctx&&ctx.state==='running';},
  configure(next:Partial<AudioSettings>){settings={...settings,...next};for(const key of ['master','effects','environment'] as const)settings[key]=Number.isFinite(settings[key])?Math.max(0,Math.min(1,settings[key])):0;try{localStorage.setItem('harbor-audio',JSON.stringify(settings));}catch{}apply();},
  pause(value:boolean){if(value===paused)return;paused=value;if(value)for(const source of voices){try{source.stop();}catch{}}apply();},
  dispose(){for(const source of voices){try{source.stop();}catch{}}wind?.stop();void ctx?.close();},
 };
}
