import {TransformNode} from '@babylonjs/core/Meshes/transformNode.js';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder.js';
import {Mesh} from '@babylonjs/core/Meshes/mesh.js';
import {Quaternion} from '@babylonjs/core/Maths/math.vector.js';
import type {Scene} from '@babylonjs/core/scene.js';
import type {Material} from '@babylonjs/core/Materials/material.js';
import {WEAPON_IDS,type WeaponId} from './weapons.ts';
export function createLobbyWeapons(scene:Scene){
 const mount=new TransformNode('lobby-held-weapon',scene);mount.position.set(0,.02,.06);
 const arm=Quaternion.FromEulerAngles(-.55,0,-.15).multiply(Quaternion.FromEulerAngles(-.8,0,0));
 mount.rotationQuaternion=arm.invert().multiply(Quaternion.FromEulerAngles(0,-Math.PI/2,.05));
 const materials=['metal','gun-ivory','gun-copper'].map(name=>scene.getMaterialByName(name)!);const models=new Map<WeaponId,Mesh[]>();
 for(const id of WEAPON_IDS){
  const parts:Mesh[]=[],long=id!=='pistol',length=id==='smg'?.62:id==='burst'?.87:id==='dmr'?1.04:id==='sniper'?1.12:id==='shotgun'?.94:id==='machinegun'?.8:.4;
  const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,material:Material)=>{const m=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);m.position.set(x,y,z);m.material=material;parts.push(m);return m;};
  const tube=(name:string,x:number,y:number,z:number,diameter:number,length:number,material:Material)=>{const m=MeshBuilder.CreateCylinder(name,{diameter,height:length,tessellation:12},scene);m.rotation.x=Math.PI/2;m.position.set(x,y,z);m.material=material;parts.push(m);return m;};
  box('held-receiver',0,.08,long?.16:.08,long?.13:.105,.14,long?.43:.27,materials[1]!);
  const grip=box('held-grip',0,-.07,-.03,.085,.21,.12,materials[0]!);grip.rotation.x=-.2;
  box('held-trigger-guard',0,-.055,.07,.06,.07,.12,materials[2]!);
  tube('held-barrel',0,.085,length*.65,id==='shotgun'?.09:.055,length*.65,materials[0]!);
  tube('held-muzzle',0,.085,length*.98,id==='shotgun'?.11:.085,.065,materials[2]!);
  box('held-rail',0,.17,long?.19:.09,.07,.025,long?.37:.2,materials[0]!);
  box('held-side-inlay',.072,.08,long?.14:.07,.015,.04,long?.25:.15,materials[2]!);
  if(long){box('held-stock',0,.04,-.26,.1,.19,.26,materials[0]!);box('held-stock-pad',0,.04,-.4,.13,.22,.035,materials[2]!);box('held-foregrip',0,.065,.42,.16,.15,.25,materials[0]!);}
  if(id==='machinegun'||id==='smg'||id==='burst'){ const magazine=box('held-magazine',0,-.1,.23,.08,.28,.15,materials[0]!);magazine.rotation.x=.12;for(let i=0;i<4;i++)box('held-vent',.076,.1,.1+i*.065,.02,.04,.025,materials[0]!);}
  if(id==='shotgun'){tube('held-second-barrel',.085,.085,.63,.085,.55,materials[0]!);for(let i=0;i<4;i++)box('held-pump-rib',0,.085,.38+i*.045,.18,.17,.018,materials[2]!);}
  if(id==='dmr'){box('held-dmr-magazine',0,-.08,.2,.08,.2,.15,materials[0]!);tube('held-dmr-sight',0,.21,.15,.045,.12,materials[2]!);}
  if(id==='sniper'){box('held-scope-mount',0,.205,.13,.07,.08,.18,materials[2]!);tube('held-scope',0,.29,.18,.12,.35,materials[0]!);tube('held-scope-rim',0,.29,.365,.145,.035,materials[2]!);}
  const merged:Mesh[]=[];for(const material of materials){const group=parts.filter(m=>m.material===material);if(!group.length)continue;const m=Mesh.MergeMeshes(group,true,true)!;m.name=`lobby-${id}-${merged.length}`;m.parent=mount;m.material=material;m.isPickable=false;m.checkCollisions=false;m.metadata={lobbyWeapon:id};m.setEnabled(false);merged.push(m);}models.set(id,merged);
 }
 mount.setEnabled(false);
 return {mount,meshes:[...models.values()].flat(),attach(hand:TransformNode|null){mount.parent=hand;},show(id:WeaponId,enabled:boolean){mount.setEnabled(enabled);for(const [key,meshes] of models)for(const mesh of meshes)mesh.setEnabled(key===id);}};
}
