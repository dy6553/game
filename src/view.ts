import { normalized } from './world.ts';

export type Look = { yaw: number; pitch: number };
export function turnView(look: Look, dx: number, dy: number, sensitivity = 0.004): Look {
  if (![dx, dy].every(Number.isFinite)) return { ...look };
  return {
    yaw: Math.atan2(Math.sin(look.yaw + dx * sensitivity), Math.cos(look.yaw + dx * sensitivity)),
    pitch: Math.max(-1.2, Math.min(1.2, look.pitch + dy * sensitivity)),
  };
}
export function viewMovement(yaw: number, x: number, y: number) {
  const input = normalized(x, y);
  // Movement uses horizontal yaw only; looking up never makes the player fly.
  return { x: Math.cos(yaw) * input.x + Math.sin(yaw) * input.y,
    z: -Math.sin(yaw) * input.x + Math.cos(yaw) * input.y };
}

export function createLookMotion(smooth:boolean){
 let look:Look={yaw:0,pitch:0},pendingYaw=0,targetPitch=0;
 function discardPending(){pendingYaw=0;targetPitch=look.pitch;}
 return {
  get look(){return look;},
  set(next:Look){look=next;discardPending();},
  discardPending,
  turn(dx:number,dy:number,sensitivity:number){
   if(!smooth){look=turnView(look,dx,dy,sensitivity);return;}
   if(!Number.isFinite(dx)||!Number.isFinite(dy)||!Number.isFinite(sensitivity))return;
   pendingYaw+=dx*sensitivity;
   targetPitch=Math.max(-1.2,Math.min(1.2,targetPitch+dy*sensitivity));
  },
  advance(dt:number){
   if(!smooth||!Number.isFinite(dt)||dt<=0)return;
   const pendingPitch=targetPitch-look.pitch;
   if(pendingYaw===0&&pendingPitch===0)return;
   const fraction=1-Math.exp(-dt/.016);
   const yawStep=Math.abs(pendingYaw*(1-fraction))<.0001?pendingYaw:pendingYaw*fraction;
   const pitch=Math.abs(pendingPitch*(1-fraction))<.0001?targetPitch:look.pitch+pendingPitch*fraction;
   pendingYaw-=yawStep;
   const yaw=look.yaw+yawStep;
   look={yaw:Math.atan2(Math.sin(yaw),Math.cos(yaw)),pitch};
  },
 };
}
