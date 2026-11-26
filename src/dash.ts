import {viewMovement} from './view.ts';
import type {CharacterType} from './characters.ts';
import type {Point} from './world.ts';
export type DashState={remaining:number;cooldown:number;dx:number;dz:number;speed?:number};
export const DASH_RULES=Object.freeze({distance:4,duration:.2,cooldown:3});
export function createDash():DashState{return {remaining:0,cooldown:0,dx:0,dz:0};}
type AbilityInput={x:number;y:number;yaw:number;grounded:boolean;canAct:boolean};
export const characterAbilities={
 robot:{name:'부스터',...DASH_RULES,leap:false,healing:0},
 'robot-cat':{name:'도약',distance:3,duration:.25,cooldown:6,leap:true,healing:0},
 welder:{name:'긴급 수리',distance:0,duration:0,cooldown:14,leap:false,healing:20},
} as const;

export function beginDash(state:DashState,input:AbilityInput,rules:{distance:number;duration:number;cooldown:number}=DASH_RULES):DashState{
 if(![input.x,input.y,input.yaw].every(Number.isFinite))throw new Error('Invalid dash direction');
 if(!input.canAct||!input.grounded||state.remaining>0||state.cooldown>1e-8)return state;
 const length=Math.hypot(input.x,input.y),direction:Point=viewMovement(input.yaw,length>1e-5?input.x/length:0,length>1e-5?input.y/length:1);
 return {remaining:rules.duration,cooldown:rules.cooldown,dx:direction.x,dz:direction.z,...(rules.duration>0&&rules.distance/rules.duration!==DASH_RULES.distance/DASH_RULES.duration?{speed:rules.distance/rules.duration}:{})};
}
export function startCharacterAbility(state:DashState,input:AbilityInput,character:CharacterType,health:number){
 const ability=characterAbilities[character];
 const healing=Math.max(0,Math.min(ability.healing,100-health));
 const dash=beginDash(state,{...input,canAct:input.canAct&&(ability.healing===0||healing>0)},ability);
 return {dash,leap:dash!==state&&ability.leap,healing:dash!==state?healing:0};
}
export function advanceDash(state:DashState,dt:number){
 if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid dash elapsed time');
 const activeSeconds=Math.min(dt,state.remaining),remaining=state.remaining-activeSeconds,cooldown=Math.max(0,state.cooldown-dt),travel=(state.speed??DASH_RULES.distance/DASH_RULES.duration)*activeSeconds;
 return {state:{...state,remaining:remaining<1e-8?0:remaining,cooldown:cooldown<1e-8?0:cooldown},activeSeconds,delta:{x:state.dx*travel,z:state.dz*travel}};
}
export function cancelDash(state:DashState):DashState{return {...state,remaining:0};}
