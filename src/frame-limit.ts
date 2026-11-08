export type FrameTarget=30|60|90|120|0;
export const FRAME_TARGETS=[30,60,90,120,0] as const;
// Draw scheduling only. Simulation and online command cadence stay on their own clocks.
export function createFrameLimit(target:FrameTarget=60){let next:number|null=null,last:number|null=null;return {setTarget(value:FrameTarget){target=FRAME_TARGETS.includes(value)?value:60;next=last=null;},reset(){next=last=null;},shouldRender(now:number){if(!Number.isFinite(now))return false;if(!target)return true;const interval=1000/target;if(next===null||last===null||now<last||now-last>250){last=now;next=now+interval;return true;}if(now+.2<next)return false;last=now;next+=interval*Math.max(1,Math.floor((now-next+.2)/interval)+1);return true;}};}
