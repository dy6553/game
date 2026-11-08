import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { BUILDINGS, COVERS } from './world.ts';
import type { Scene } from '@babylonjs/core/scene.js';

// Small, authored street details. Tall props stay in existing solid footprints;
// pavement details are flush and wires stay well above the player's head.
export function addStreetDetails(scene:Scene) {
  const material=(name:string,color:string,emission?:string)=>{
    const m=new StandardMaterial(`detail-${name}`,scene);m.diffuseColor=Color3.FromHexString(color);
    m.specularColor.set(0.04,0.04,0.04);m.maxSimultaneousLights=6;
    if(emission)m.emissiveColor=Color3.FromHexString(emission);return m;
  };
  const iron=material('iron','#30343b'),wood=material('aged-wood','#6e513d');
  const brass=material('brass','#a18b61'),ceramic=material('terracotta','#99755c');
  const green=material('leaves','#53664b'),petals=material('flowers','#c9a6b9');
  const amber=material('lantern-glass','#ad8654','#6f4c28');
  const paper=material('sign-cream','#d1b68b'),fallen=material('fallen-leaf','#a48850');
  const grey=material('stone-inlay','#5b5553'),dark=material('recess','#252c33');
  const softReflection=material('soft-reflection','#bba786','#35291d');softReflection.alpha=0.13;softReflection.disableDepthWrite=true;
  const meshes:Mesh[]=[];
  const add=(m:Mesh,x:number,y:number,z:number,mat:StandardMaterial)=>{
    m.position.set(x,y,z);m.material=mat;m.isPickable=false;meshes.push(m);return m;
  };
  const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,mat:StandardMaterial)=>
    add(MeshBuilder.CreateBox(`detail-${name}`,{width:w,height:h,depth:d},scene),x,y,z,mat);
  const cylinder=(name:string,x:number,y:number,z:number,diameter:number,height:number,mat:StandardMaterial)=>
    add(MeshBuilder.CreateCylinder(`detail-${name}`,{diameter,height,tessellation:12},scene),x,y,z,mat);
  const tube=(name:string,path:Vector3[],radius:number,mat:StandardMaterial)=>
    add(MeshBuilder.CreateTube(`detail-${name}`,{path,radius,tessellation:6},scene),0,0,0,mat);
  const planter=(x:number,y:number,z:number,width:number,variant:number)=>{
    box('window-box',x,y,z,width,0.22,0.28,ceramic);
    box('soil',x,y+0.12,z,width-0.06,0.025,0.23,dark);
    for(let i=0;i<5;i++) {
      const stemX=x+(i-2)*width/5;
      cylinder('plant-stem',stemX,y+0.29,z,0.025,0.35,green);
      for(let leaf=0;leaf<3;leaf++) {
        const angle=i*2.4+leaf*2;
        const m=add(MeshBuilder.CreateDisc('detail-plant-leaf',{radius:1,tessellation:6,sideOrientation:Mesh.DOUBLESIDE},scene),stemX+Math.cos(angle)*0.08,y+0.29+leaf*0.06,z+Math.sin(angle)*0.07,green);
        m.scaling.set(0.065,0.15,1);m.rotation.set(0.5,angle,0.7);
      }
      if((i+variant)%2===0) {
        const flower=add(MeshBuilder.CreateSphere('detail-flower',{diameter:0.09,segments:6},scene),stemX,y+0.48,z,petals);
        flower.scaling.y=0.5;
      }
    }
  };
  for(const [index,b] of BUILDINGS.entries()) {
    const front=b.z<0?1:-1, faceZ=b.z+front*(b.depth/2+0.2);
    // Shop entry hardware, utility boxes and a modest light above each doorway.
    if(!b.enterable)box('door-handle',b.x+0.43,1.2,faceZ+front*0.08,0.035,0.28,0.06,brass);
    if(!b.enterable)box('door-kickplate',b.x,0.35,faceZ+front*0.06,1.1,0.15,0.035,iron);
    if(!b.enterable)box('doorstep',b.x,0.09,faceZ,1.65,0.12,0.3,grey);
    box('entry-lintel',b.x,b.enterable?3.35:2.6,faceZ,1.9,0.16,0.38,wood);
    box('entry-strip-light',b.x,b.enterable?3.24:2.49,faceZ+front*0.12,1.4,0.045,0.06,amber);
    const lampX=b.x-b.width*0.38;
    box('wall-lamp-bracket',lampX,2.7,faceZ,0.1,0.12,0.45,iron);
    box('wall-lamp-cap',lampX,2.75,faceZ+front*0.3,0.45,0.1,0.36,iron);
    box('wall-lamp-pane',lampX,2.49,faceZ+front*0.3,0.28,0.42,0.24,amber);
    box('wall-lamp-base',lampX,2.24,faceZ+front*0.3,0.36,0.07,0.3,iron);
    for(const side of [-1,1])box('lamp-mullion',lampX+side*0.14,2.49,faceZ+front*0.43,0.025,0.45,0.025,iron);
    // A projecting, unlettered sign uses a simple cup/plate motif, avoiding fake text.
    const signX=b.x+b.width*0.39,signZ=faceZ+front*0.45;
    tube('sign-bracket',[new Vector3(signX,3.35,faceZ-front*0.1),new Vector3(signX,3.35,signZ+front*0.35)],0.035,iron);
    for(const side of [-1,1])cylinder('sign-chain',signX+side*0.27,3.08,signZ,0.018,0.45,iron);
    const sign=add(MeshBuilder.CreateDisc('detail-shop-sign',{radius:0.52,tessellation:24,sideOrientation:Mesh.DOUBLESIDE},scene),signX,2.65,signZ,paper);
    sign.rotation.y=front<0?Math.PI:0;
    const cupZ=signZ+front*0.015;
    if(index%3===0) {
      box('sign-cup',signX-0.05,2.65,cupZ,0.28,0.24,0.025,wood);
      box('sign-saucer',signX,2.5,cupZ,0.4,0.035,0.025,wood);
      const handle=add(MeshBuilder.CreateTorus('detail-sign-handle',{diameter:0.16,thickness:0.025,tessellation:12},scene),signX+0.16,2.66,cupZ,wood);handle.rotation.x=Math.PI/2;
      for(let steam=0;steam<2;steam++)tube('sign-steam',[new Vector3(signX-0.11+steam*0.14,2.83,cupZ),new Vector3(signX-0.08+steam*0.14,2.96,cupZ)],0.012,wood);
    } else if(index%3===1) {
      for(const side of [-1,1]) {
        const book=box('sign-book',signX+side*0.15,2.65,cupZ,0.27,0.38,0.025,wood);book.rotation.z=side*0.1;
        for(let line=0;line<3;line++)box('book-line',signX+side*0.15,2.57+line*0.08,cupZ+front*0.02,0.19,0.015,0.01,paper);
      }
    } else {
      box('sign-pot',signX,2.48,cupZ,0.24,0.18,0.025,wood);
      tube('sign-stem',[new Vector3(signX,2.55,cupZ),new Vector3(signX,2.95,cupZ)],0.016,green);
      for(const side of [-1,1]) {
        const leaf=add(MeshBuilder.CreateDisc('detail-sign-leaf',{radius:0.14,tessellation:8,sideOrientation:Mesh.DOUBLESIDE},scene),signX+side*0.11,2.78,cupZ,green);
        leaf.scaling.x=0.5;leaf.rotation.z=-side*0.65;
      }
    }
    // Window planters, curtain edges, rail end caps and small wall-mounted utilities.
    for(const side of [-1,1]) {
      planter(b.x+side*b.width*0.27,3.46,faceZ+front*0.55,1.6,index);
      box('curtain',b.x+side*(b.width/2-1.15),4.25,faceZ+front*0.04,0.15,1.1,0.025,paper);
      for(const cap of [-1,1])cylinder('rail-finial',b.x+side*b.width*0.27+cap*1.42,4.05,faceZ+front*0.95,0.09,0.13,brass);
    }
    box('meter-box',b.x-b.width/2+0.5,1.15,faceZ,0.3,0.48,0.15,iron);
    tube('wall-conduit',[new Vector3(b.x-b.width/2+0.5,0.2,faceZ),new Vector3(b.x-b.width/2+0.5,1.5,faceZ),new Vector3(b.x-b.width/2+0.85,1.65,faceZ)],0.025,iron);
    for(let tie=0;tie<3;tie++)box('pipe-fastener',b.x+b.width/2-0.2,1.4+tie*2,faceZ,0.21,0.045,0.18,brass);
    // Flush drain channels and scattered small leaves never create movement barriers.
    const drainZ=faceZ+front*0.35;
    box('drain-recess',b.x,0.072,drainZ,3.5,0.012,0.28,dark);
    for(let slot=0;slot<19;slot++)box('drain-bar',b.x-1.6+slot*0.18,0.08,drainZ,0.035,0.012,0.26,iron);
    for(let leaf=0;leaf<9;leaf++) {
      const x=b.x+Math.sin(leaf*8+index)*3,z=drainZ+front*(0.3+Math.abs(Math.cos(leaf*5))*0.7);
      const m=add(MeshBuilder.CreateDisc('detail-fallen-leaf',{radius:0.09,tessellation:6,sideOrientation:Mesh.DOUBLESIDE},scene),x,0.085,z,fallen);
      m.rotation.set(Math.PI/2,leaf*1.7,0);m.scaling.x=0.55;
    }
    // A narrow damp-stone highlight at each shop; no weather simulation or mirror plane.
    const sheen=add(MeshBuilder.CreateDisc('detail-stone-sheen',{radius:1,tessellation:24},scene),b.x,0.068,faceZ+front*0.7,softReflection);
    sheen.rotation.x=Math.PI/2;sheen.scaling.set(1.8,0.3,1);
  }
  // Slightly sagging utility wires connect neighbouring roofs across side alleys.
  for(const z of [-19,19])for(const x of [-25,25])for(let strand=0;strand<2;strand++) {
    const points=Array.from({length:13},(_,i)=>{const t=i/12;return new Vector3(x-3+t*6,7.2-Math.sin(t*Math.PI)*0.55+strand*0.1,z+strand*0.2);});
    tube('overhead-wire',points,0.018,iron);
  }
  for(const c of COVERS.filter(c=>c.id.startsWith('planter-'))) {
    // Seat slats, legs and bolts add definition to the existing planter-side bench.
    for(let slat=0;slat<4;slat++)box('bench-slat',c.x,0.63,c.z-1.2+slat*0.085,2.5,0.035,0.065,wood);
    for(const side of [-1,1]) {
      box('bench-leg',c.x+side,0.3,c.z-1.05,0.08,0.6,0.28,iron);
      box('bench-back-post',c.x+side,0.95,c.z-0.88,0.06,0.8,0.06,iron);
    }
    for(let slat=0;slat<3;slat++)box('bench-back',c.x,0.9+slat*0.12,c.z-0.88,2.5,0.08,0.05,wood);
    for(let brick=0;brick<9;brick++)box('planter-block-joint',c.x-1.65+brick*0.4,0.55,c.z-0.905,0.015,0.85,0.012,grey);
  }
  for(const side of [-1,1]) {
    for(let x=-42;x<44;x+=2)if(Math.abs(x)>12)box('curb',x,0.08,side*5.25,1.85,0.13,0.22,grey);
    for(let z=-32;z<34;z+=2)if(Math.abs(z)>13)box('curb',side*5.25,0.08,z,0.22,0.13,1.85,grey);
  }
  for(const x of [-20,20])for(const z of [-3.7,3.7]) {
    cylinder('drain-cover',x,0.052,z,0.65,0.025,dark);
    for(let slit=0;slit<5;slit++)box('drain-cover-slot',x+(slit-2)*0.1,0.07,z,0.045,0.008,0.4,iron);
  }
  // Soft lantern halos are separate transparent billboards; they must never merge
  // with opaque props or become ray targets.
  const size=64,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const radius=Math.hypot((x+0.5-size/2)/(size/2),(y+0.5-size/2)/(size/2));
    const i=(y*size+x)*4;data[i]=255;data[i+1]=201;data[i+2]=126;
    data[i+3]=Math.round(Math.max(0,1-radius)**3*42);
  }
  const texture=RawTexture.CreateRGBATexture(data,size,size,scene,false,false);texture.hasAlpha=true;texture.name='authored-lantern-halo';
  const haloMat=material('halo','#ffffff','#ffffff');haloMat.disableLighting=true;
  haloMat.diffuseTexture=texture;haloMat.useAlphaFromDiffuseTexture=true;haloMat.backFaceCulling=false;haloMat.disableDepthWrite=true;
  const glowRoot=new TransformNode('street-light-halos',scene);
  for(const x of [-10.7,10.7])for(const z of [-29,-10,10,29]) {
    const halo=MeshBuilder.CreatePlane('lantern-halo',{size:1.5},scene);
    halo.position.set(x,4.2,z);halo.material=haloMat;halo.billboardMode=Mesh.BILLBOARDMODE_ALL;halo.parent=glowRoot;halo.isPickable=false;
  }
  return {meshes,glowRoot};
}
