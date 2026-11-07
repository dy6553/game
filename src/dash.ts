import {viewMovement} from './view.ts';
import type {Point} from './world.ts';
export type DashState={remaining:number;cooldown:number;dx:number;dz:number};
export const DASH_RULES=Object.freeze({distance:4,duration:.2,cooldown:3});
export function createDash():DashState{return {remaining:0,cooldown:0,dx:0,dz:0};}
export function beginDash(state:DashState,input:{x:number;y:number;yaw:number;grounded:boolean;canAct:boolean}):DashState{
 if(![input.x,input.y,input.yaw].every(Number.isFinite))throw new Error('Invalid dash direction');
 if(!input.canAct||!input.grounded||state.remaining>0||state.cooldown>1e-8)return state;
 const length=Math.hypot(input.x,input.y),direction:Point=viewMovement(input.yaw,length>1e-5?input.x/length:0,length>1e-5?input.y/length:1);
 return {remaining:DASH_RULES.duration,cooldown:DASH_RULES.cooldown,dx:direction.x,dz:direction.z};
}
export function advanceDash(state:DashState,dt:number){
 if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid dash elapsed time');
 const activeSeconds=Math.min(dt,state.remaining),remaining=state.remaining-activeSeconds,cooldown=Math.max(0,state.cooldown-dt),travel=DASH_RULES.distance/DASH_RULES.duration*activeSeconds;
 return {state:{...state,remaining:remaining<1e-8?0:remaining,cooldown:cooldown<1e-8?0:cooldown},activeSeconds,delta:{x:state.dx*travel,z:state.dz*travel}};
}
export function cancelDash(state:DashState):DashState{return {...state,remaining:0};}
