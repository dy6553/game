import {expansionLayouts} from './expansion-layouts.ts';
import type {Point,Rect} from './world.ts';
export const SNOW_LAYOUT_REVISION='igloo-v3';
export type SnowShell={id:string;vertices:readonly (readonly number[])[];room:string};
const shells:SnowShell[]=[],solids:Rect[]=[];
function piece(id:string,room:string,vertices:number[][]){
 const xs=vertices.map(p=>p[0]!),ys=vertices.map(p=>p[1]!),zs=vertices.map(p=>p[2]!);const lo=[Math.min(...xs),Math.min(...ys),Math.min(...zs)],hi=[Math.max(...xs),Math.max(...ys),Math.max(...zs)];
 if(hi[1]!-lo[1]!<.005||hi[0]!-lo[0]!<.005||hi[2]!-lo[2]!<.005)return;
 shells.push({id,room,vertices});solids.push({id,shellVertices:vertices,x:(lo[0]!+hi[0]!)/2,z:(lo[2]!+hi[2]!)/2,width:hi[0]!-lo[0]!,depth:hi[2]!-lo[2]!,yMin:lo[1]!,yMax:hi[1]!});
}
// The same shell pieces define physical bounds and visible walls at every quality.
const hub='Research hub',levels=[0,3.4,5.5,7.4,9,10.2,11];
for(let j=0;j<levels.length-1;j++)for(let i=0;i<32;i++){
 const a=i/32*Math.PI*2,b=(i+1)/32*Math.PI*2,mid=(a+b)/2;
 if(j===0&&(Math.abs(Math.sin(mid))<.20||Math.abs(Math.cos(mid))<.20))continue;
 const p0=Math.asin(levels[j]!/11),p1=Math.asin(levels[j+1]!/11);
 const at=(a:number,p:number,inner:boolean)=>[(inner?17.4:18)*Math.cos(p)*Math.cos(a),(inner?10.4:11)*Math.sin(p),(inner?14.4:15)*Math.cos(p)*Math.sin(a)];
 piece(`${hub} shell-${j}-${i}`,hub,[at(a,p0,false),at(b,p0,false),at(b,p1,false),at(a,p1,false),at(a,p0,true),at(b,p0,true),at(b,p1,true),at(a,p1,true)]);
}
function vault(id:string,room:string,cx:number,cz:number,r:number,h:number,length:number,alongX=false,sideOpening=false){
 const n=16;
 const at=(a:number,end:number,inner:boolean)=>{const x=Math.cos(a)*(r-(inner?.5:0)),y=Math.sin(a)*(h-(inner?.5:0));return alongX?[cx+end*length/2,y,cz+x]:[cx+x,y,cz+end*length/2];};
 for(let i=0;i<n;i++){
  const a=i/n*Math.PI,b=(i+1)/n*Math.PI;
  // Wing side airlocks line up with the center connector and stay open to standing players.
  const ranges=sideOpening&&Math.max(Math.sin(a),Math.sin(b))*h<3.5?[[-1,-3.3/(length/2)],[3.3/(length/2),1]]:[[-1,1]];
  for(const [k,range] of ranges.entries()){const [near,far]=range;piece(`${id} shell-${i}-${k}`,room,[at(a,near!,false),at(b,near!,false),at(b,far!,false),at(a,far!,false),at(a,near!,true),at(b,near!,true),at(b,far!,true),at(a,far!,true)]);}
 }
}
// Piecewise linear profiles exactly match the sixteen-segment vaults. A single
// extruded portal closes arch corners; no rectangular trim crosses an opening.
function archProfile(r:number,h:number){return Array.from({length:17},(_,i)=>{const a=(16-i)/16*Math.PI;return [Math.cos(a)*r,Math.sin(a)*h] as const;});}
function profileHeight(points:readonly (readonly [number,number])[],x:number){
 for(let i=1;i<points.length;i++)if(x<=points[i]![0]+1e-8){const a=points[i-1]!,b=points[i]!;return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}
 return 0;
}
function portal(id:string,room:string,cx:number,cz:number,outer:readonly (readonly [number,number])[],r:number,h:number,depth:number,alongX=false){
 const inner=archProfile(r,h),xs=[...new Set([...outer,...inner].map(p=>p[0]))].sort((a,b)=>a-b);
 const at=(x:number,y:number,end:number)=>alongX?[cx+end*depth/2,y,cz+x]:[cx+x,y,cz+end*depth/2];
 for(let i=1;i<xs.length;i++){
  const a=xs[i-1]!,b=xs[i]!,lo=(x:number)=>Math.abs(x)>=r?0:profileHeight(inner,x),hi=(x:number)=>profileHeight(outer,x);
  piece(`${id}-${i}`,room,[at(a,lo(a),-1),at(b,lo(b),-1),at(b,hi(b),-1),at(a,hi(a),-1),at(a,lo(a),1),at(b,lo(b),1),at(b,hi(b),1),at(a,hi(a),1)]);
 }
}
const rooms=[{id:hub,x:0,z:0,width:36,depth:30,height:11},{id:'West laboratory',x:33,z:0,width:12,depth:52,height:6},{id:'East laboratory',x:-33,z:0,width:12,depth:52,height:6}];
for(const b of rooms.slice(1)){
 vault(b.id,b.id,b.x,b.z,6,6,52,false,true);
 for(const side of [-1,1]){
  portal(`${b.id} end-wall-${side}`,b.id,b.x,side*25.75,archProfile(6,6),2.7,3.1,.5);
  // The entrance starts where the cap ends, rather than running through it.
  vault(`${b.id} entry-${side}`,b.id,b.x,side*28.5,3.2,3.6,5);
  if(side===Math.sign(b.x))portal(`${b.id} side-portal`,b.id,b.x-side*5.45,0,[[-3.3,3.8],[3.3,3.8]],2.7,3.1,1.5,true);
 }
}
for(const side of [-1,1]){
 portal(`igloo-hub-side-portal-${side}`,hub,side*17.05,0,[[-3.3,3.8],[3.3,3.8]],2.7,3.1,2.1,true);
 vault(`igloo-link-${side}`,hub,side*22.45,0,3.2,3.6,8.7,true);
 portal(`igloo-hub-front-portal-${side}`,hub,0,side*14.15,[[-3.6,3.8],[3.6,3.8]],3.1,3.3,1.9);
 vault(`igloo-entry-${side}`,hub,0,side*18.05,3.6,3.8,5.9);
}
// Preserve supplies and consoles; replace rectangular shell and link posts.
const old=expansionLayouts.snow;solids.push(...old.solids.filter(r=>!old.rooms.some(b=>r.id.startsWith(b.id))&&!r.id.startsWith('link support')));
for(const side of [-1,1])for(const z of [-2,7])solids.push({id:`igloo-workbench-${side}-${z}`,x:side*6,z,width:2.8,depth:1.2,yMin:0,yMax:1.1});
solids.push({id:'igloo-central-pillar',x:0,z:0,width:2.4,depth:2.4,yMin:0,yMax:8.8});
export const snowShells:readonly SnowShell[]=shells;
export const iglooLayout={width:160,depth:120,rooms,solids};
export const snowShellIds=new Set(shells.map(p=>p.id));
export function snowShelter(p:Point){
 if((p.y??0)>10.4)return undefined;
 if((p.x/17.4)**2+(p.z/14.4)**2<1&&((p.y??0)+.2)<10.4*Math.sqrt(Math.max(0,1-(p.x/17.4)**2-(p.z/14.4)**2)))return hub;
 for(const b of rooms.slice(1))if(Math.abs(p.z)<25.8&&Math.abs(p.x-b.x)<5.5)return b.id;
 if(Math.abs(p.x)<3.1&&Math.abs(p.z)<21)return hub;
 if(Math.abs(p.z)<2.7&&Math.abs(p.x)<28)return hub;
 for(const b of rooms.slice(1))if(Math.abs(p.x-b.x)<2.7&&Math.abs(p.z)<31)return b.id;
 return undefined;
}
