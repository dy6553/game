export type FrameTarget=30|60|90|120|0;
export const FRAME_TARGETS=[30,60,90,120,0] as const;
export type FramePreference=FrameTarget|'auto';
export const FRAME_PREFERENCES=['auto',...FRAME_TARGETS] as const;
// Draw scheduling only. Simulation and online command cadence stay on their own clocks.
export function createFrameLimit(preference:FramePreference='auto'){
 let target:FrameTarget=preference==='auto'?60:preference;
 let next:number|null=null,last:number|null=null;
 let seconds=0,frames=0,slowWindows=0,stableWindows=0;
 function resetSamples(){seconds=frames=slowWindows=stableWindows=0;}
 function changeTarget(value:FrameTarget){target=value;next=last=null;resetSamples();}
 return {
  get target(){return target;},
  setTarget(value:FramePreference){
   preference=FRAME_PREFERENCES.includes(value)?value:'auto';
   changeTarget(preference==='auto'?60:preference);
  },
  reset(){next=last=null;resetSamples();},
  sample(dt:number,active:boolean){
   if(preference!=='auto')return;
   if(!active||dt>.5){resetSamples();return;}
   if(!Number.isFinite(dt)||dt<=0)return;
   seconds+=dt;frames++;
   if(seconds<2)return;
   const fps=frames/seconds;seconds=frames=0;
   if(target===60){
    slowWindows=fps<48?slowWindows+1:0;
    if(slowWindows>=2)changeTarget(30);
   }else{
    stableWindows=fps>=27?stableWindows+1:0;
    if(stableWindows>=10)changeTarget(60);
   }
  },
  shouldRender(now:number){
   if(!Number.isFinite(now))return false;
   if(!target)return true;
   const interval=1000/target;
   if(next===null||last===null||now<last||now-last>250){
    last=now;next=now+interval;return true;
   }
   if(now+.2<next)return false;
   last=now;next+=interval*Math.max(1,Math.floor((now-next+.2)/interval)+1);
   return true;
  },
 };
}
