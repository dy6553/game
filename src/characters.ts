import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';

export const CHARACTER_TYPES = ['robot', 'robot-cat', 'welder'] as const;
export type CharacterType = typeof CHARACTER_TYPES[number];
export function isCharacterType(value: unknown): value is CharacterType { return value === 'robot' || value === 'robot-cat' || value === 'welder'; }

export function createCharacter(scene: Scene, parent: TransformNode, type: CharacterType) {
  const root = new TransformNode(`character-${type}`, scene); root.parent = parent;
  const meshes: Mesh[] = [];
  const mat = (name: string, color: string, glow = false) => {
    const old = scene.getMaterialByName(name); if (old instanceof StandardMaterial) return old;
    const m = new StandardMaterial(name, scene); m.diffuseColor = Color3.FromHexString(color);
    m.specularColor.set(0.4, 0.44, 0.48); m.specularPower = 64;
    if (glow) m.emissiveColor = m.diffuseColor.scale(0.85);
    return m;
  };
  const ivory = mat(type==='welder'?'welder-armor':'robot-ivory', type==='welder'?'#d88b32':'#e6dfcc'), dark = mat('robot-joint', '#263447');
  const black = mat('robot-display', '#071b27'), copper = mat('robot-copper', '#b58c59');
  const silver = mat('robot-silver', '#98a9b3'), cyan = mat('robot-cyan', '#65e9ef', true);
  const amber = mat('robot-amber', '#ffbe5e', true), cloth = mat('robot-pouch', '#454958');
  const glow = type === 'robot' ? cyan : amber;
  const add = (m: Mesh, x: number, y: number, z: number, material: StandardMaterial) => {
    m.position.set(x,y,z); m.material=material; m.parent=root; m.isPickable=false; meshes.push(m); return m;
  };
  const round = (name: string,x:number,y:number,z:number,w:number,h:number,d:number,m:StandardMaterial,power=0.45) => {
    const mesh=MeshBuilder.CreateSphere(name,{diameter:2,segments:24,updatable:true},scene);
    const points=mesh.getVerticesData(VertexBuffer.PositionKind)!;
    for(let i=0;i<points.length;i++) points[i]=Math.sign(points[i]!)*Math.pow(Math.abs(points[i]!),power)*[w/2,h/2,d/2][i%3]!;
    const normals:number[]=[]; VertexData.ComputeNormals(points,mesh.getIndices()!,normals);
    mesh.updateVerticesData(VertexBuffer.PositionKind,points,true);mesh.updateVerticesData(VertexBuffer.NormalKind,normals);
    return add(mesh,x,y,z,m);
  };
  const ball=(name:string,x:number,y:number,z:number,d:number,m:StandardMaterial)=>add(MeshBuilder.CreateSphere(name,{diameter:d,segments:20},scene),x,y,z,m);
  const cylinder=(name:string,x:number,y:number,z:number,d:number,h:number,m:StandardMaterial)=>add(MeshBuilder.CreateCylinder(name,{diameter:d,height:h,tessellation:24},scene),x,y,z,m);
  const arms:Array<{upper:TransformNode;lower:TransformNode}>=[];let weaponSocket:Mesh;
  for(const side of [-1,1]) {
    round('robot-boot',side*0.24,0.15,0.1,0.38,0.29,0.6,ivory);
    round('boot-sole',side*0.24,0.045,0.12,0.4,0.08,0.61,dark);
    round('boot-toe',side*0.24,0.18,0.36,0.27,0.09,0.06,copper);
    round('shin',side*0.24,0.46,0,0.25,0.5,0.29,dark);
    round('shin-plate',side*0.24,0.46,0.13,0.26,0.35,0.12,ivory);
    round('shin-inset',side*0.24,0.46,0.2,0.08,0.19,0.02,silver);
    ball('knee-joint',side*0.24,0.73,0,0.29,dark);
    const knee=cylinder('knee-hub',side*0.24,0.73,0.15,0.2,0.055,copper);knee.rotation.x=Math.PI/2;
    round('thigh',side*0.22,0.94,0,0.28,0.3,0.32,ivory);
    ball('hip-joint',side*0.22,1.08,0,0.22,dark);
    const armStart=meshes.length;
    ball('shoulder-joint',side*0.46,1.48,0,0.31,dark);
    round('shoulder-shell',side*0.48,1.49,0.03,0.31,0.28,0.38,ivory);
    round('upper-arm',side*0.5,1.27,0,0.2,0.29,0.23,ivory);
    const upperEnd=meshes.length;
    ball('elbow',side*0.51,1.09,0.02,0.2,dark);
    round('forearm-shell',side*0.52,0.94,0.055,0.23,0.28,0.25,ivory);
    round('forearm-trim',side*0.52,0.94,0.19,0.075,0.17,0.025,glow);
    cylinder('wrist',side*0.52,0.76,0.08,0.14,0.12,dark);
    round('palm',side*0.52,0.65,0.1,0.2,0.19,0.13,dark);
    for(let finger=0;finger<3;finger++) {
      round('finger',side*0.52+(finger-1)*0.055,0.54,0.1,0.04,0.13,0.07,silver);
      ball('knuckle',side*0.52+(finger-1)*0.055,0.6,0.18,0.042,copper);
    }
    round('thumb',side*0.66,0.65,0.14,0.07,0.13,0.075,silver);
    const upper=new TransformNode(`arm-upper-${side}`,scene);upper.parent=root;upper.position.set(side*.46,1.48,0);
    const elbowPosition=new Vector3(side*.51,1.09,.02),lower=new TransformNode(`arm-lower-${side}`,scene);lower.parent=upper;lower.position.copyFrom(elbowPosition.subtract(upper.position));
    for(const mesh of meshes.slice(armStart,upperEnd)){mesh.parent=upper;mesh.position.subtractInPlace(upper.position);}
    const forearmMeshes=meshes.slice(upperEnd);for(const mesh of forearmMeshes){mesh.parent=lower;mesh.position.subtractInPlace(elbowPosition);}
    if(side===1)weaponSocket=forearmMeshes.find(m=>m.name==='palm')!;arms.push({upper,lower});
    for(let screw=0;screw<2;screw++) ball('armor-fastener',side*0.33,1.23+screw*0.25,0.235,0.045,silver);
  }
  round('waist',0,1.1,0,0.55,0.17,0.35,dark);
  round('torso-shell',0,1.38,0,0.75,0.55,0.46,ivory);
  round('chest-recess',0,1.4,0.24,0.47,0.26,0.045,dark);
  round('chest-light',0,1.43,0.275,0.2,0.085,0.025,glow);
  for(let i=0;i<4;i++) round('chest-vent',(i-1.5)*0.08,1.29,0.265,0.045,0.05,0.02,silver);
  round('backpack',0,1.4,-0.3,0.46,0.47,0.25,dark);
  round('backpack-panel',0,1.45,-0.445,0.17,0.25,0.03,ivory);
  round('backpack-charge',0,1.45,-0.465,0.06,0.15,0.02,cyan);
  round('belt',0,1.12,0.06,0.65,0.11,0.46,cloth);
  round('belt-buckle',0,1.12,0.31,0.14,0.12,0.045,copper);
  round('utility-pouch',-0.3,1.02,0.28,0.24,0.25,0.16,cloth);
  round('pouch-flap',-0.3,1.12,0.375,0.25,0.08,0.025,copper);
  cylinder('neck',0,1.72,0,0.23,0.2,dark);
  if(type!=='robot-cat') {
    round('robot-head-rim',0,2,0,1.09,0.88,0.79,copper);
    round('robot-head',0,2.025,-0.02,1.04,0.83,0.8,ivory);
    round('robot-screen-rim',0,2,0.36,0.88,0.62,0.13,silver);
    round('robot-screen',0,2,0.425,0.81,0.55,0.1,black);
    for(const side of [-1,1]) {
      round('robot-eye',side*0.2,2.025,0.49,0.105,0.28,0.03,cyan,0.7);
      const ear=cylinder('robot-ear',side*0.56,2,-0.025,0.4,0.1,dark);ear.rotation.z=Math.PI/2;
      const hub=cylinder('robot-ear-trim',side*0.62,2,-0.025,0.29,0.045,copper);hub.rotation.z=Math.PI/2;
      ball('robot-ear-light',side*0.65,2,-0.025,0.12,amber);
    }
    round('brow-emblem',0,2.42,0.1,0.24,0.035,0.19,copper);
    if(type==='welder'){
      round('welding-mask',0,2.01,.49,.92,.72,.16,dark);
      round('welding-visor-rim',0,2.05,.59,.69,.3,.08,copper);
      round('welding-visor',0,2.05,.64,.55,.17,.035,cyan);
      round('welding-filter',0,1.79,.6,.32,.12,.055,silver);
      for(const side of [-1,1])cylinder('welding-tank',side*.16,1.4,-.53,.23,.58,copper);
    }else {
    cylinder('antenna',-0.34,2.55,-0.12,0.045,0.45,dark);
    ball('antenna-tip',-0.34,2.79,-0.12,0.095,amber);
    }
  } else {
    round('cat-head',0,2,0,0.93,0.72,0.72,ivory,0.6);
    round('cat-face',0,2,0.34,0.78,0.43,0.08,dark);
    for(const side of [-1,1]) {
      const ear=add(MeshBuilder.CreateCylinder('cat-ear',{diameterTop:0.025,diameterBottom:0.46,height:0.55,tessellation:3},scene),side*0.34,2.45,-0.02,ivory);ear.rotation.z=-side*0.2;
      const inner=add(MeshBuilder.CreateCylinder('cat-ear-inset',{diameterTop:0.015,diameterBottom:0.25,height:0.38,tessellation:3},scene),side*0.34,2.45,0.1,amber);inner.rotation.z=-side*0.2;
      const eye=round('cat-eye',side*0.2,2.045,0.398,0.26,0.11,0.045,amber);eye.rotation.z=side*0.22;
      round('cat-eye-pupil',side*0.2,2.045,0.427,0.025,0.1,0.015,black);
      const cheek=round('cat-cheek',side*0.34,1.86,0.31,0.28,0.17,0.2,ivory);cheek.rotation.z=side*0.25;
      for(let i=0;i<2;i++) { const whisker=round('cat-whisker',side*0.39,1.9-i*0.065,0.44,0.15,0.018,0.018,copper);whisker.rotation.z=side*(0.1+i*0.2); }
    }
    ball('cat-nose',0,1.94,0.43,0.085,copper);
    round('cat-forehead-light',0,2.3,0.18,0.045,0.18,0.04,cyan);
    const path=Array.from({length:25},(_,i)=>{const t=i/24;return new Vector3(0.12+0.55*Math.sin(t*2.5),0.9+1.1*t,-0.25-0.65*Math.sin(t*Math.PI*0.85));});
    add(MeshBuilder.CreateTube('cat-tail',{path,radius:0.075,tessellation:12},scene),0,0,0,dark);
    for(let i=2;i<25;i+=3) ball('tail-segment',path[i]!.x,path[i]!.y,path[i]!.z,0.17,i%2?copper:ivory);
    const tip=path[path.length-1]!;ball('cat-tail-tip',tip.x,tip.y,tip.z,0.18,cyan);
  }
  return {root,meshes,type,weaponSocket:weaponSocket!,poseLobby(active:boolean,phase=0,twoHanded=true){
    root.scaling.y=active?1+Math.sin(phase*1.7)*.003:1;root.rotation.z=active?Math.sin(phase*.9)*.003:0;
    arms.forEach(({upper,lower},i)=>{const raised=active&&(i===1||twoHanded);upper.rotation.set(raised?(i===1?-.55:-.65)+Math.sin(phase*1.7)*.008:0,0,raised?(i===1?-.15:.2):0);lower.rotation.set(raised?-.8:0,0,0);});
  }};
}
