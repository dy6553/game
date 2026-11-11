import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder.js';
import {Mesh} from '@babylonjs/core/Meshes/mesh.js';
import {VertexBuffer} from '@babylonjs/core/Buffers/buffer.js';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial.js';
import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import {Color3} from '@babylonjs/core/Maths/math.color.js';
import type {Scene} from '@babylonjs/core/scene.js';import type {World} from './world.ts';
import {buildingLandmarks} from './wayfinding.ts';
export function createWayfindingSigns(scene:Scene,world:World){
 const landmarks=buildingLandmarks(world),material=new StandardMaterial('navigation-signs',scene);material.disableLighting=true;material.diffuseColor=Color3.White();material.emissiveColor=Color3.White();
 const canvasAvailable=typeof document!=='undefined'&&typeof document.createElement('canvas').getContext==='function';
 let texture:DynamicTexture|undefined;
 if(canvasAvailable){texture=new DynamicTexture('navigation-atlas',{width:1024,height:1024},scene,false);material.diffuseTexture=texture;material.emissiveTexture=texture;}
 const ctx=texture?.getContext();const signs:Mesh[]=[];
 for(const [index,l] of landmarks.entries()){
  const b=world.BUILDINGS.find(b=>b.id===l.id)!,door=world.doorRect(b),front=b.z<0?1:-1;
  for(const [level,height] of [[0,0],[1,world.SECOND_FLOOR],[2,b.height]] as const){
   const tile=index*3+level,tx=(tile%4)*256,ty=Math.floor(tile/4)*128,floor=level===2?'RF':level===1?'2F':'1F';
   if(ctx){ctx.fillStyle='#0c2631';ctx.fillRect(tx,ty,256,128);ctx.fillStyle=l.color;ctx.fillRect(tx,ty,6,128);ctx.font='bold 29px sans-serif';ctx.fillText(`${l.code}  /  ${floor}`,tx+18,ty+39,224);ctx.font='bold 21px sans-serif';ctx.fillStyle='#f3f5e9';ctx.fillText(l.name,tx+18,ty+75,224);ctx.font='17px sans-serif';ctx.fillStyle=l.color;ctx.fillText(level===0?'입구 · 서쪽 계단 → 2F':level===1?'2층 · 동쪽 계단 → RF':'옥상 · 출입구 / 난간',tx+18,ty+106,224);}
   const sign=MeshBuilder.CreatePlane(`navigation-${l.code}-${floor}`,{width:3.2,height:1.6,sideOrientation:Mesh.DOUBLESIDE},scene);
   sign.material=material;sign.isPickable=false;sign.checkCollisions=false;
   if(level===0){sign.position.set(b.x-b.width*.28,1.75,door.z+front*.8);sign.rotation.y=front>0?Math.PI:0;}
   else {const stairs=world.stairways(b)[level===1?0:1]!;sign.position.set(stairs.end.x,height+(level===2?.8:1.45),b.z+(stairs.end.z>b.z?1:-1)*(b.depth/2-.42));sign.rotation.y=stairs.end.z<b.z?Math.PI:0;}
   const uv=sign.getVerticesData(VertexBuffer.UVKind)!;sign.setVerticesData(VertexBuffer.UVKind,uv.map((v,i)=>i%2?(1-(ty+128)/1024)+v*128/1024:tx/1024+v*256/1024));
   sign.metadata={navigation:{...l,floor}};sign.freezeWorldMatrix();signs.push(sign);
  }
 }
 texture?.update();const batch=Mesh.MergeMeshes(signs,true,true,undefined,false,false);if(batch){batch.name='navigation-signs-batch';batch.isPickable=false;batch.checkCollisions=false;batch.metadata={navigation:landmarks};batch.freezeWorldMatrix();return [batch];}return signs;
}
