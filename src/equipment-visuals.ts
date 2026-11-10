import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder.js';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial.js';
import {Quaternion,Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {Color3} from '@babylonjs/core/Maths/math.color.js';
import type {Scene} from '@babylonjs/core/scene.js';
import type {Projectile,ToolEvent} from './equipment.ts';

export function createEquipmentVisuals(scene:Scene){
 const mat=(name:string,color:string)=>{
  const material=new StandardMaterial(name,scene);
  material.diffuseColor=Color3.FromHexString(color);
  material.emissiveColor=material.diffuseColor.scale(.35);
  return material;
 };
 const orange=mat('grenade-shell','#a06c3f'),white=mat('flash-shell','#d2e3ec');
 const balls=Array.from({length:80},(_,i)=>{
  const mesh=MeshBuilder.CreateSphere('thrown-tool-'+i,{diameter:.24,segments:6},scene);
  mesh.isPickable=false;mesh.setEnabled(false);
  return mesh;
 });
 const bursts=Array.from({length:8},(_,i)=>{
  const mesh=MeshBuilder.CreateSphere('tool-burst-'+i,{diameter:1,segments:8},scene);
  const material=mat('tool-burst-material-'+i,'#ffad64');
  material.disableLighting=true;material.alpha=0;
  mesh.material=material;mesh.isPickable=false;mesh.setEnabled(false);
  return {mesh,material,life:0,kind:'grenade'};
 });
 let at=0,last=-1,previousProjectileCount=0;
 return {
  clear(){
   last=-1;
   for(let i=0;i<previousProjectileCount;i++)balls[i]!.setEnabled(false);
   previousProjectileCount=0;
   for(const burst of bursts)if(burst.life>0){
    burst.life=0;burst.mesh.setEnabled(false);
   }
  },
  update(projectiles:Projectile[],events:ToolEvent[],dt:number,visible=true){
   const count=Math.min(projectiles.length,balls.length);
   for(let i=0;i<count;i++){
    const mesh=balls[i]!,projectile=projectiles[i]!;
    mesh.setEnabled(visible);
    mesh.position.set(projectile.x,projectile.y,projectile.z);
    mesh.material=projectile.kind==='flash'?white:orange;
    mesh.scaling.set(1,1,projectile.kind==='rocket'?3:1);
    mesh.rotationQuaternion=projectile.kind==='rocket'
     ?Quaternion.FromUnitVectorsToRef(Vector3.Forward(),new Vector3(projectile.vx,projectile.vy,projectile.vz).normalize(),new Quaternion())
     :Quaternion.Identity();
   }
   for(let i=count;i<previousProjectileCount;i++)balls[i]!.setEnabled(false);
   previousProjectileCount=count;

   for(const event of events)if(event.id>last){
    last=event.id;
    const burst=bursts[at++%bursts.length]!;
    burst.kind=event.kind;burst.life=.5;
    burst.mesh.position.set(event.x,event.y,event.z);
    burst.material.emissiveColor=Color3.FromHexString(event.kind==='heal'?'#85f0b7':event.kind==='flash'?'#e7f5ff':'#ffad64');
   }
   for(const burst of bursts)if(burst.life>0){
    burst.life=Math.max(0,burst.life-dt);
    burst.mesh.setEnabled(visible&&burst.life>0);
    const progress=1-burst.life/.5;
    burst.mesh.scaling.setAll((burst.kind==='grenade'||burst.kind==='rocket'?6:2)*progress+.1);
    burst.material.alpha=burst.life*.3;
   }
  },
 };
}
