import type {World,Doors,Rect} from './world.ts';
export type Vec3={x:number;y:number;z:number};
export function rayBox(origin:readonly number[],direction:readonly number[],min:readonly number[],max:readonly number[],limit=150){
 let near=0,far=limit;for(let i=0;i<3;i++){if(Math.abs(direction[i]!)<1e-9){if(origin[i]!<min[i]!||origin[i]!>max[i]!)return Infinity;continue;}let a=(min[i]!-origin[i]!)/direction[i]!,b=(max[i]!-origin[i]!)/direction[i]!;if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return Infinity;}return near;
}
const SHELL_FACES=[[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]];
function triangleHit(o:number[],d:number[],a:readonly number[],b:readonly number[],c:readonly number[]){
 const ex=b[0]!-a[0]!,ey=b[1]!-a[1]!,ez=b[2]!-a[2]!,fx=c[0]!-a[0]!,fy=c[1]!-a[1]!,fz=c[2]!-a[2]!,px=d[1]!*fz-d[2]!*fy,py=d[2]!*fx-d[0]!*fz,pz=d[0]!*fy-d[1]!*fx,det=ex*px+ey*py+ez*pz;if(Math.abs(det)<1e-9)return Infinity;
 const tx=o[0]!-a[0]!,ty=o[1]!-a[1]!,tz=o[2]!-a[2]!,u=(tx*px+ty*py+tz*pz)/det;if(u< -1e-8||u>1+1e-8)return Infinity;
 const qx=ty*ez-tz*ey,qy=tz*ex-tx*ez,qz=tx*ey-ty*ex,v=(d[0]!*qx+d[1]!*qy+d[2]!*qz)/det;if(v< -1e-8||u+v>1+1e-8)return Infinity;
 const t=(fx*qx+fy*qy+fz*qz)/det;return t>=0&&t<=1?t:Infinity;
}
export function boxHit(a:Vec3,b:Vec3,r:Rect,radius=0){const d=[b.x-a.x,b.y-a.y,b.z-a.z],lo=[r.x-r.width/2-radius,(r.yMin??0)-radius,r.z-r.depth/2-radius],hi=[r.x+r.width/2+radius,(r.yMax??20)+radius,r.z+r.depth/2+radius],o=[a.x,a.y,a.z];let t=rayBox(o,d,lo,hi,1);if(!Number.isFinite(t))return null;if(r.shellVertices&&radius===0){t=Infinity;for(const f of SHELL_FACES){const v=r.shellVertices;t=Math.min(t,triangleHit(o,d,v[f[0]!]!,v[f[1]!]!,v[f[2]!]!),triangleHit(o,d,v[f[0]!]!,v[f[2]!]!,v[f[3]!]!));}if(!Number.isFinite(t))return null;}let axis=0,error=Infinity;for(let i=0;i<3;i++){if(Math.abs(d[i]!)<1e-9)continue;const q=o[i]!+d[i]!*t,e=Math.min(Math.abs(q-lo[i]!),Math.abs(q-hi[i]!));if(e<error){axis=i;error=e;}}return {t,axis};}
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
