export type Stance='stand'|'crouch'|'prone';
export const isStance=(v:unknown):v is Stance=>v==='stand'||v==='crouch'||v==='prone';
export const stanceStats=(v:Stance='stand')=>v==='prone'?{eye:.45,height:.8,speed:.25}:v==='crouch'?{eye:1.15,height:1.5,speed:.55}:{eye:1.95,height:2.5,speed:1};
