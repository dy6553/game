import type {World,Doors,Rect} from './world.ts';
export type Vec3={x:number;y:number;z:number};
export function rayBox(origin:readonly number[],direction:readonly number[],min:readonly number[],max:readonly number[],limit=150){
 let near=0,far=limit;for(let i=0;i<3;i++){if(Math.abs(direction[i]!)<1e-9){if(origin[i]!<min[i]!||origin[i]!>max[i]!)return Infinity;continue;}let a=(min[i]!-origin[i]!)/direction[i]!,b=(max[i]!-origin[i]!)/direction[i]!;if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return Infinity;}return near;
}
export function boxHit(a:Vec3,b:Vec3,r:Rect,radius=0){const d=[b.x-a.x,b.y-a.y,b.z-a.z],lo=[r.x-r.width/2-radius,(r.yMin??0)-radius,r.z-r.depth/2-radius],hi=[r.x+r.width/2+radius,(r.yMax??20)+radius,r.z+r.depth/2+radius],o=[a.x,a.y,a.z];const t=rayBox(o,d,lo,hi,1);if(!Number.isFinite(t))return null;let axis=0,error=Infinity;for(let i=0;i<3;i++){if(Math.abs(d[i]!)<1e-9)continue;const q=o[i]!+d[i]!*t,e=Math.min(Math.abs(q-lo[i]!),Math.abs(q-hi[i]!));if(e<error){axis=i;error=e;}}return {t,axis};}
export function unobstructed(world:World,doors:Doors,a:Vec3,b:Vec3){return !world.shotBoxes(doors).some(r=>{const h=boxHit(a,b,r);return h&&h.t<.995;});}
