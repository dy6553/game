import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { BUILDINGS, COVERS } from './world.ts';
import type { Scene } from '@babylonjs/core/scene.js';

const pools = [
  ...[-10.7,10.7].flatMap(x=>[-29,-10,10,29].map(z=>({x,z,radius:6.1,strength:Math.abs(z)<20?0.9:0.55}))),
  ...BUILDINGS.map(b=>({x:b.x,z:b.z+(b.z<0?1:-1)*(b.depth/2+1),radius:4.6,strength:0.6+b.palette*0.13})),
];
export function sampleNightGround(x:number,z:number) {
  let warmth=0;
  for(const p of pools) warmth+=Math.exp(-((x-p.x)**2+(z-p.z)**2)/(2*p.radius**2))*p.strength;
  warmth=Math.min(1.2,warmth);
  let shade=1;
  for(const b of BUILDINGS) {
    const dx=Math.max(0,Math.abs(x-(b.x-2.8))-b.width/2);
    const dz=Math.max(0,Math.abs(z-(b.z+1.6))-b.depth/2);
    shade*=1-0.22*Math.exp(-(dx*dx+dz*dz)/0.9);
  }
  for(const p of COVERS.filter(c=>c.id!=='van')) {
    const distance=((x-p.x-1.5)/2.1)**2+((z-p.z+2)/3.2)**2;
    if(distance<2) shade*=1-0.28*Math.exp(-distance)*(0.65+0.35*Math.sin(x*7+Math.sin(z*5))**2);
  }
  return {r:(0.285+warmth*0.33)*shade,g:(0.3+warmth*0.19)*shade,b:(0.355+warmth*0.065)*shade};
}

// Authored indirect light is baked into vertex colors so mobile light-count limits
// cannot turn the whole plaza back into evenly blue-grey pavement.
export function createNightGround(scene:Scene,source:StandardMaterial,name:string,x:number,z:number,width:number,depth:number,y:number) {
  const materialName=`night-${source.name}`;
  let mat=scene.getMaterialByName(materialName) as StandardMaterial|null;
  if(!mat) {
    mat=new StandardMaterial(materialName,scene);mat.diffuseTexture=source.diffuseTexture;
    mat.diffuseColor=Color3.White();mat.emissiveColor=Color3.White();mat.disableLighting=true;
    mat.specularColor=Color3.Black();
  }
  const mesh=MeshBuilder.CreateGround(name,{width,height:depth,subdivisions:Math.ceil(Math.max(width,depth)/2)},scene);
  mesh.position.set(x,y,z);mesh.material=mat;mesh.isPickable=false;
  const positions=mesh.getVerticesData('position')!,uvs=mesh.getVerticesData('uv')!;
  const colors:number[]=[];
  for(let i=0;i<positions.length;i+=3) {
    const color=sampleNightGround(x+positions[i]!,z+positions[i+2]!);
    const road=source.name==='asphalt';
    colors.push(color.r*(road?0.72:1),color.g*(road?0.79:1),color.b*(road?0.93:1),1);
    const uvIndex=i/3*2;uvs[uvIndex]=positions[i]!/2;uvs[uvIndex+1]=positions[i+2]!/2;
  }
  mesh.setVerticesData('color',colors);mesh.setVerticesData('uv',uvs);
  return mesh;
}
