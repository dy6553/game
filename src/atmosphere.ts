import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import type { Scene } from '@babylonjs/core/scene.js';
import { canStand } from './world.ts';

// Authored reflection cards, not screen-space reflections. Bounded mobile cost.
export function createAtmosphere(scene:Scene){
  const meshes:Mesh[]=[];
  let seed=7309;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const texture=(kind:'wet'|'halo'|'ripple')=>{
    const n=128,data=new Uint8Array(n*n*4);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const u=(x+.5)/n*2-1,v=(y+.5)/n*2-1,r=Math.hypot(u,v);
      let a=0;
      if(kind==='halo')a=Math.pow(Math.max(0,1-r),3)*.5;
      if(kind==='wet')a=Math.pow(Math.max(0,1-u*u-v*v),2)*(.3+.7*Math.pow(.5+.5*Math.sin(y*.8+Math.sin(x*.14)*2),4));
      if(kind==='ripple')a=Math.max(0,1-u*u)*Math.max(0,1-v*v)*(.2+.8*Math.pow(.5+.5*Math.sin(y*1.7+Math.sin(x*.12)*2),8));
      const i=(y*n+x)*4;data[i]=255;data[i+1]=255;data[i+2]=255;data[i+3]=Math.round(a*255);
    }
    const t=RawTexture.CreateRGBATexture(data,n,n,scene,false,false);t.hasAlpha=true;t.name=`atmosphere-${kind}`;return t;
  };
  const wet=texture('wet'),halo=texture('halo'),ripple=texture('ripple');
  const mat=(name:string,color:string,tex:RawTexture,alpha:number)=>{
    const m=new StandardMaterial(name,scene);m.diffuseColor=Color3.FromHexString(color);m.emissiveColor=m.diffuseColor;m.disableLighting=true;
    m.diffuseTexture=tex;m.useAlphaFromDiffuseTexture=true;m.alpha=alpha;m.disableDepthWrite=true;m.backFaceCulling=false;return m;
  };
  const gold=mat('wet-amber','#ffc27a',wet,.38),blue=mat('wet-blue','#78b8d4',wet,.2);
  const waterGold=mat('water-gold','#ffd292',ripple,.7),waterBlue=mat('water-blue','#90d8ed',ripple,.45);
  const glow=mat('lantern-aura','#ffc07b',halo,.65);
  const finish=(mesh:Mesh,m:StandardMaterial)=>{mesh.material=m;mesh.isPickable=false;mesh.receiveShadows=false;meshes.push(mesh);return mesh;};
  const groups=new Map<StandardMaterial,Mesh[]>();
  const card=(x:number,z:number,w:number,h:number,y:number,m:StandardMaterial)=>{
    const p=finish(MeshBuilder.CreateGround('reflection-card',{width:w,height:h},scene),m);p.position.set(x,y,z);
    const group=groups.get(m)??[];group.push(p);groups.set(m,group);return p;
  };
  for(const x of [-10.7,10.7])for(const z of [-29,-10,10,29]){
    for(let i=0;i<5;i++){
      const px=x+(random()-.5)*3,pz=z+(random()-.5)*7;
      if(canStand({x:px,z:pz},.15))card(px,pz,1+random()*2,2+random()*4,.085+i*.001,gold);
    }
    const p=finish(MeshBuilder.CreatePlane('lantern-atmospheric-glow',{size:2.4},scene),glow);
    p.position.set(x,4.15,z);p.billboardMode=Mesh.BILLBOARDMODE_ALL;
  }
  for(let i=0;i<45;i++){
    const x=(random()-.5)*80,z=(random()-.5)*64;
    if(canStand({x,z},.5))card(x,z,1+random()*3,1+random()*4,.08,blue);
  }
  for(let i=0;i<34;i++){
    const x=-85+i*5+random()*2;
    card(x,67+random()*30,1+random()*3,12+random()*25,-.82,i%3===0?waterBlue:waterGold);
  }
  for(const [material,parts] of groups){
    const merged=Mesh.MergeMeshes(parts,true,true,undefined,false,false);
    if(merged){merged.name=`atmosphere-${material.name}`;merged.material=material;merged.isPickable=false;meshes.push(merged);}
  }
  // Sparse stars stay well above the aim line.
  const starMat=mat('star-glow','#b5d9ef',halo,.8),stars:Mesh[]=[];
  for(let i=0;i<65;i++){
    const p=finish(MeshBuilder.CreatePlane('star',{size:.35+random()*.7},scene),starMat);
    const angle=random()*Math.PI*2;p.position.set(Math.cos(angle)*240,75+random()*180,Math.sin(angle)*240);p.lookAt(scene.activeCamera!.position);stars.push(p);
  }
  const starBatch=Mesh.MergeMeshes(stars,true,true,undefined,false,false);if(starBatch){starBatch.name='atmosphere-stars';starBatch.isPickable=false;meshes.push(starBatch);}
  let time=0;
  return {update(dt:number){time+=Math.min(dt,.1);ripple.vOffset=Math.sin(time*.6)*.018;wet.uOffset=Math.sin(time*.2)*.002;},setQuality(high:boolean){for(const mesh of meshes)if(!mesh.isDisposed()&&mesh.name==='lantern-atmospheric-glow')mesh.setEnabled(high);},meshes};
}
