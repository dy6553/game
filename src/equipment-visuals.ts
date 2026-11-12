import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder.js';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial.js';
import {Quaternion,Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {Color3} from '@babylonjs/core/Maths/math.color.js';
import type {Scene} from '@babylonjs/core/scene.js';import type {Projectile,ToolEvent} from './equipment.ts';
export function createEquipmentVisuals(scene:Scene){
 const mat=(name:string,color:string)=>{const m=new StandardMaterial(name,scene);m.diffuseColor=Color3.FromHexString(color);m.emissiveColor=m.diffuseColor.scale(.35);return m;};
 const orange=mat('grenade-shell','#a06c3f'),white=mat('flash-shell','#d2e3ec');
 const seed=MeshBuilder.CreateSphere('thrown-tool-0',{diameter:.24,segments:6},scene);
 const balls=Array.from({length:80},(_,i)=>{const mesh=i?seed.clone('thrown-tool-'+i):seed;mesh.isPickable=false;mesh.setEnabled(false);mesh.rotationQuaternion=new Quaternion();return mesh;});
 const burstSeed=MeshBuilder.CreateSphere('tool-burst-0',{diameter:1,segments:8},scene);
 const bursts=Array.from({length:8},(_,i)=>{const mesh=i?burstSeed.clone('tool-burst-'+i):burstSeed,m=mat('tool-burst-material-'+i,'#ffad64');m.disableLighting=true;m.alpha=0;mesh.material=m;mesh.isPickable=false;mesh.setEnabled(false);return {mesh,material:m,life:0,kind:'grenade'};});
 const glow=mat('rich-glow','#ffc06b');glow.disableLighting=true;glow.emissiveColor=Color3.FromHexString('#ffc06b');
 const smoke=mat('rich-smoke','#657078');smoke.disableLighting=true;smoke.alpha=.14;smoke.disableDepthWrite=true;
 const ringMat=mat('rich-ring-material','#ffd9a0');ringMat.disableLighting=true;ringMat.alpha=.4;ringMat.disableDepthWrite=true;
 const sparkSeed=MeshBuilder.CreateBox('rich-particle-0',{size:.035},scene);
 const particles=Array.from({length:32},(_,i)=>{const kind=i<16?'spark':i<24?'smoke':'trail',mesh=i===0?sparkSeed:kind==='spark'?sparkSeed.clone('rich-particle-'+i):seed.clone('rich-particle-'+i);mesh.material=kind==='smoke'?smoke:glow;mesh.isPickable=false;mesh.setEnabled(false);return {mesh,kind,life:0,total:1,velocity:Vector3.Zero()};});
 const ringSeed=MeshBuilder.CreateTorus('rich-ring-0',{diameter:1,thickness:.035,tessellation:24},scene);
 const rings=Array.from({length:4},(_,i)=>{const mesh=i?ringSeed.clone('rich-ring-'+i):ringSeed;mesh.material=ringMat;mesh.isPickable=false;mesh.setEnabled(false);return {mesh,life:0};});
 let at=0,last=-1,previousProjectileCount=0,effectsEnabled=true,detailed=false,particleAt=0,ringAt=0,trailAge=0;const direction=Vector3.Zero(),forward=Vector3.Forward();
 const colors={heal:Color3.FromHexString('#85f0b7'),flash:Color3.FromHexString('#e7f5ff'),blast:Color3.FromHexString('#ffad64')};
 function clearRich(){for(const p of particles){p.life=0;p.mesh.setEnabled(false);}for(const r of rings){r.life=0;r.mesh.setEnabled(false);}trailAge=0;}
 function spawn(kind:'spark'|'smoke'|'trail',x:number,y:number,z:number,index:number){const offset=kind==='spark'?0:kind==='smoke'?16:24,count=kind==='spark'?16:8,p=particles[offset+(particleAt++%count)]!;p.mesh.position.set(x,y,z);p.mesh.visibility=1;p.mesh.scaling.setAll(kind==='smoke'?2:kind==='trail'?.35:1);p.total=p.life=kind==='smoke'?.85:kind==='trail'?.2:.4;p.velocity.set(kind==='spark'?Math.cos(index*2.4)*3:0,kind==='smoke'?.6:kind==='spark'?1.5+(index%3)*.5:0,kind==='spark'?Math.sin(index*2.4)*3:0);p.mesh.setEnabled(true);}
 return {
  setDetailed(value:boolean){detailed=value;if(!value)clearRich();},
  setEffectsEnabled(value:boolean){effectsEnabled=value;if(!value){clearRich();for(const b of bursts){b.life=0;b.mesh.setEnabled(false);}}},
  clear(){last=-1;for(let i=0;i<previousProjectileCount;i++)balls[i]!.setEnabled(false);previousProjectileCount=0;for(const b of bursts){b.life=0;b.mesh.setEnabled(false);}clearRich();},
  update(projectiles:Projectile[],events:ToolEvent[],dt:number,visible=true){
   const count=Math.min(projectiles.length,balls.length);trailAge+=dt;let trails=0;const drawTrail=detailed&&effectsEnabled&&trailAge>=.06;if(drawTrail)trailAge=0;
   for(let i=0;i<count;i++){const mesh=balls[i]!,p=projectiles[i]!;mesh.setEnabled(visible);mesh.position.set(p.x,p.y,p.z);mesh.material=p.kind==='flash'?white:orange;mesh.scaling.set(1,1,p.kind==='rocket'?3:1);if(p.kind==='rocket'){direction.set(p.vx,p.vy,p.vz).normalize();Quaternion.FromUnitVectorsToRef(forward,direction,mesh.rotationQuaternion!);if(drawTrail&&trails++<8)spawn('trail',p.x,p.y,p.z,i);}else mesh.rotationQuaternion!.set(0,0,0,1);}
   for(let i=count;i<previousProjectileCount;i++)balls[i]!.setEnabled(false);previousProjectileCount=count;
   for(const event of events)if(event.id>last){last=event.id;if(!effectsEnabled)continue;const b=bursts[at++%bursts.length]!;b.kind=event.kind;b.life=.5;b.mesh.position.set(event.x,event.y,event.z);b.material.emissiveColor.copyFrom(event.kind==='heal'?colors.heal:event.kind==='flash'?colors.flash:colors.blast);
    if(detailed&&(event.kind==='grenade'||event.kind==='rocket')){const ring=rings[ringAt++%rings.length]!;ring.life=.4;ring.mesh.position.set(event.x,event.y+.07,event.z);for(let i=0;i<10;i++)spawn('spark',event.x,event.y,event.z,i);for(let i=0;i<3;i++)spawn('smoke',event.x+Math.sin(i)*.4,event.y+.2,event.z+Math.cos(i)*.4,i);}
   }
   for(const b of bursts)if(b.life>0){b.life=Math.max(0,b.life-dt);b.mesh.setEnabled(visible&&b.life>0);const progress=1-b.life/.5;b.mesh.scaling.setAll((b.kind==='grenade'||b.kind==='rocket'?6:2)*progress+.1);b.material.alpha=b.life*.3;}
   for(const p of particles)if(p.life>0){p.life=Math.max(0,p.life-dt);p.mesh.setEnabled(visible&&p.life>0);p.mesh.position.x+=p.velocity.x*dt;p.mesh.position.y+=p.velocity.y*dt;p.mesh.position.z+=p.velocity.z*dt;if(p.kind==='spark')p.velocity.y-=6*dt;if(p.kind==='smoke')p.mesh.scaling.setAll(2+(p.total-p.life)*5);p.mesh.visibility=Math.max(0,p.life/p.total);}
   for(const r of rings)if(r.life>0){r.life=Math.max(0,r.life-dt);r.mesh.setEnabled(visible&&r.life>0);r.mesh.scaling.setAll(.2+(1-r.life/.4)*8);r.mesh.visibility=r.life/.4;}
  },
 };
}
