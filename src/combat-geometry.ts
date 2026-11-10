import type {World,Doors,Rect} from './world.ts';
export type Vec3={x:number;y:number;z:number};
export function rayBox(origin:readonly number[],direction:readonly number[],min:readonly number[],max:readonly number[],limit=150){
 let near=0,far=limit;for(let i=0;i<3;i++){if(Math.abs(direction[i]!)<1e-9){if(origin[i]!<min[i]!||origin[i]!>max[i]!)return Infinity;continue;}let a=(min[i]!-origin[i]!)/direction[i]!,b=(max[i]!-origin[i]!)/direction[i]!;if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return Infinity;}return near;
}
export function boxHit(a:Vec3,b:Vec3,r:Rect,radius=0){const d=[b.x-a.x,b.y-a.y,b.z-a.z],lo=[r.x-r.width/2-radius,(r.yMin??0)-radius,r.z-r.depth/2-radius],hi=[r.x+r.width/2+radius,(r.yMax??20)+radius,r.z+r.depth/2+radius],o=[a.x,a.y,a.z];const t=rayBox(o,d,lo,hi,1);if(!Number.isFinite(t))return null;let axis=0,error=Infinity;for(let i=0;i<3;i++){if(Math.abs(d[i]!)<1e-9)continue;const q=o[i]!+d[i]!*t,e=Math.min(Math.abs(q-lo[i]!),Math.abs(q-hi[i]!));if(e<error){axis=i;error=e;}}return {t,axis};}
export function firstShotBox(world:World,doors:Doors,a:Vec3,b:Vec3,stopBefore?:number){
 const minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x);
 const minZ=Math.min(a.z,b.z),maxZ=Math.max(a.z,b.z);
 const minY=Math.min(a.y,b.y),maxY=Math.max(a.y,b.y);
 let nearest:ReturnType<typeof boxHit>=null;
 for(const rect of world.shotBoxes(doors)){
  const halfX=rect.width/2,halfZ=rect.depth/2;
  if(rect.x-halfX>maxX||rect.x+halfX<minX||rect.z-halfZ>maxZ||rect.z+halfZ<minZ||
     (rect.yMin??0)>maxY||(rect.yMax??20)<minY)continue;
  const hit=boxHit(a,b,rect);
  if(!hit)continue;
  if(stopBefore!==undefined){
   if(hit.t<stopBefore)return hit;
  }else if(!nearest||hit.t<nearest.t)nearest=hit;
 }
 return nearest;
}
export function unobstructed(world:World,doors:Doors,a:Vec3,b:Vec3){
 return firstShotBox(world,doors,a,b,.995)===null;
}
