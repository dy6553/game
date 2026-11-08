import {Mesh} from '@babylonjs/core/Meshes/mesh.js';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder.js';
import {VertexData} from '@babylonjs/core/Meshes/mesh.vertexData.js';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode.js';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial.js';
import {RawTexture} from '@babylonjs/core/Materials/Textures/rawTexture.js';
import {Texture} from '@babylonjs/core/Materials/Textures/texture.js';
import {Color3} from '@babylonjs/core/Maths/math.color.js';
import type {Scene} from '@babylonjs/core/scene.js';
import type {Pickup} from './inventory.ts';

// One fixed set per map. No lights, particles or per-frame mesh/material creation.
export function createSupplyCrates(scene:Scene,initial:Pickup[]){
 const material=(name:string,color:string,power=64)=>{const m=new StandardMaterial('supply-'+name,scene);m.diffuseColor=Color3.FromHexString(color);m.specularColor.set(.5,.58,.65);m.specularPower=power;return m;};
 const body=material('graphite','#263546',96),panel=material('armor','#40556a',64),metal=material('alloy','#b5bfcb',128),rubber=material('rubber','#101a25',16),brass=material('latch','#bc9763',96);
 const grain=new Uint8Array(64*64*3);let seed=1729;for(let i=0;i<grain.length;i+=3){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=236+(seed%20);grain[i]=grain[i+1]=grain[i+2]=v;}
 const texture=RawTexture.CreateRGBTexture(grain,64,64,scene,true,false,Texture.TRILINEAR_SAMPLINGMODE);texture.name='supply-brushed-grain';texture.anisotropicFilteringLevel=4;body.diffuseTexture=texture;panel.diffuseTexture=texture;
 const colors={quad:'#e6b9ff',bazooka:'#ff784d',smg:'#f9dc77',burst:'#ff9b8d',dmr:'#8fbfff',pistol:'#6be5f1',machinegun:'#77edbd',shotgun:'#ffc56b',sniper:'#c5a6ff',grenade:'#ff9c72',flash:'#dbefff',medkit:'#8df0b5'};
 const chamfer=(name:string,w:number,h:number,d:number,cut:number,mat:StandardMaterial)=>{
  const ring=[[-w/2+cut,-d/2],[w/2-cut,-d/2],[w/2,-d/2+cut],[w/2,d/2-cut],[w/2-cut,d/2],[-w/2+cut,d/2],[-w/2,d/2-cut],[-w/2,-d/2+cut]];
  const positions:number[]=[],indices:number[]=[],normals:number[]=[],uvs:number[]=[];
  for(let i=0;i<8;i++){const a=ring[i]!,b=ring[(i+1)%8]!,base=positions.length/3;positions.push(a[0]!, -h/2,a[1]!,b[0]!,-h/2,b[1]!,b[0]!,h/2,b[1]!,a[0]!,h/2,a[1]!);indices.push(base,base+1,base+2,base,base+2,base+3);uvs.push(0,0,1,0,1,1,0,1);}
  for(const side of [-1,1]){const center=positions.length/3;positions.push(0,side*h/2,0);uvs.push(.5,.5);for(const [x,z] of ring){positions.push(x!,side*h/2,z!);uvs.push(x!/w+.5,z!/d+.5);}for(let i=0;i<8;i++){const a=center+1+i,b=center+1+(i+1)%8;indices.push(...(side>0?[center,a,b]:[center,b,a]));}}
  VertexData.ComputeNormals(positions,indices,normals);const mesh=new Mesh(name,scene),data=new VertexData();data.positions=positions;data.indices=indices;data.normals=normals;data.uvs=uvs;data.applyToMesh(mesh);mesh.material=mat;return mesh;
 };
 const crates=initial.map(crate=>{
  const root=new TransformNode(crate.id+'-case',scene);root.position.set(crate.x,crate.y??0,crate.z);
  const tint=Color3.FromHexString(colors[crate.equipmentId??crate.weaponId]),accent=material(crate.id+'-light',colors[crate.equipmentId??crate.weaponId],80),charge=material(crate.id+'-charge',colors[crate.equipmentId??crate.weaponId],80);accent.emissiveColor=tint.scale(.7);charge.emissiveColor=tint.clone();
  const parts:Mesh[]=[];
  const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,mat:StandardMaterial)=>{const m=MeshBuilder.CreateBox(crate.id+'-'+name,{width:w,height:h,depth:d},scene);m.position.set(x,y,z);m.material=mat;parts.push(m);return m;};
  const shell=chamfer(crate.id+'-body',1.48,.58,.96,.1,body);shell.position.y=.48;parts.push(shell);
  const lid=chamfer(crate.id+'-lid',1.56,.16,1.04,.12,body);lid.position.y=.86;parts.push(lid);
  const base=chamfer(crate.id+'-base',1.58,.11,1.05,.12,panel);base.position.y=.19;parts.push(base);
  box('lid-seal',0,.755,0,1.49,.035,.99,rubber);
  for(const x of [-.66,.66])for(const z of [-.4,.4]){box('foot',x,.085,z,.21,.13,.2,rubber);box('corner',x,.49,z,.14,.64,.17,metal);}
  for(const x of [-.42,.42]){box('lock-base',x,.7,-.51,.16,.23,.09,rubber);box('lock',x,.72,-.57,.105,.17,.045,brass);box('lock-notch',x,.72,-.6,.04,.055,.012,rubber);}
  for(const x of [-.43,0,.43]){const hinge=MeshBuilder.CreateCylinder(crate.id+'-hinge',{diameter:.13,height:.18,tessellation:8},scene);hinge.rotation.z=Math.PI/2;hinge.position.set(x,.81,.51);hinge.material=metal;parts.push(hinge);}
  for(const x of [-.751,.751]){box('side-panel',x,.49,0,.025,.31,.57,panel);for(const z of [-.16,0,.16])box('vent',x*1.015,.49,z,.022,.18,.055,rubber);}
  box('display',0,.49,-.495,.74,.29,.04,rubber);
  // Raised weapon silhouettes are geometry: readable without fonts, texture downloads or new assets.
  if(crate.equipmentId){if(crate.equipmentId==='medkit'){box('medical-cross-h',0,.54,-.535,.32,.07,.035,accent);box('medical-cross-v',0,.54,-.535,.07,.24,.035,accent);}else{box('tool-body',0,.52,-.535,.18,.19,.045,accent);box('tool-top',.015,.66,-.535,.12,.05,.04,metal);}}else {
  box('receiver',0,.54,-.527,.25,.075,.03,metal);
  const length=crate.weaponId==='pistol'?.15:crate.weaponId==='sniper'||crate.weaponId==='dmr'?.36:crate.weaponId==='smg'?.2:.29;
  box('barrel',.12+length/2,.55,-.527,length,.032,.03,metal);const grip=box('grip',-.05,.46,-.527,.055,.12,.03,metal);grip.rotation.z=-.2;
  if(crate.weaponId!=='pistol')box('stock',-.2,.54,-.527,.14,.04,.03,metal);
  if(crate.weaponId==='shotgun')box('second-barrel',.25,.51,-.527,.29,.025,.03,metal);
  if(crate.weaponId==='sniper'){box('scope-post',.02,.6,-.527,.035,.06,.03,metal);box('scope',.02,.635,-.527,.17,.035,.03,metal);}
  }
  for(const x of [-.52,.52])box('light',x,.88,-.53,.16,.035,.025,accent);
  box('top-inset',0,.95,0,.78,.018,.55,panel);box('top-badge',0,.964,0,.4,.012,.07,accent);
  box('charge-track',0,.33,-.508,1.12,.055,.04,rubber);
  const groups=new Map<StandardMaterial,Mesh[]>();for(const part of parts){const mat=part.material as StandardMaterial;const group=groups.get(mat)??[];group.push(part);groups.set(mat,group);}
  let index=0;for(const [mat,group] of groups){const merged=Mesh.MergeMeshes(group,true,true)!;merged.name=mat===body?crate.id:crate.id+'-detail-'+index++;merged.parent=root;merged.isPickable=false;merged.checkCollisions=false;merged.receiveShadows=true;}
  const bar=MeshBuilder.CreateBox(crate.id+'-charge-bar',{width:1.08,height:.026,depth:.018},scene);bar.position.set(0,.33,-.535);bar.parent=root;bar.material=charge;bar.isPickable=false;bar.checkCollisions=false;
  return {id:crate.id,root,bar,accent,charge,tint,waiting:false};
 });
 const amber=Color3.FromHexString('#e4a954');
 return {update(pickups:Pickup[],visible:boolean){for(const c of crates){const state=pickups.find(p=>p.id===c.id);c.root.setEnabled(visible&&!!state);if(!state)continue;c.root.position.set(state.x,state.y??0,state.z);const waiting=state.remaining>0,fraction=waiting?Math.max(.015,1-state.remaining/20):1;c.bar.scaling.x=fraction;c.bar.position.x=-.54+.54*fraction;if(waiting!==c.waiting){c.waiting=waiting;c.accent.emissiveColor.copyFrom(c.tint.scale(waiting?.08:.7));c.charge.emissiveColor.copyFrom(waiting?amber:c.tint);c.charge.diffuseColor.copyFrom(waiting?amber:c.tint);}}}};
}
