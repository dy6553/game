import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';

export function createRobotImpact(scene:Scene,root:TransformNode,body:Mesh[]) {
  // Private copies prevent opponent flashes/eye shutdown from changing the player.
  const materials=new Map<StandardMaterial,{mat:StandardMaterial;emission:Color3;diffuse:Color3;lit:boolean}>();
  for(const mesh of body)if(mesh.material instanceof StandardMaterial){
    const original=mesh.material;
    if(!materials.has(original))materials.set(original,{mat:original.clone(`opponent-impact-${original.name}`),emission:original.emissiveColor.clone(),diffuse:original.diffuseColor.clone(),lit:original.emissiveColor.r+original.emissiveColor.g+original.emissiveColor.b>0});
    mesh.material=materials.get(original)!.mat;
  }
  const material=(name:string,color:string,glow:boolean)=>{const mat=new StandardMaterial(name,scene);mat.diffuseColor=Color3.FromHexString(color);if(glow){mat.emissiveColor=mat.diffuseColor.clone();mat.disableLighting=true;}return mat;};
  const electric=material('robot-fx-electric','#b4eeff',true),gold=material('robot-fx-gold','#ffd59b',true),metal=material('robot-fx-metal','#658494',false),smoke=material('robot-fx-smoke','#647784',false);
  smoke.alpha=.22;smoke.disableDepthWrite=true;
  const particles=Array.from({length:32},(_,i)=>{
    const kind=i<24?'spark':i<30?'debris':'smoke';
    const mesh=kind==='smoke'?MeshBuilder.CreateSphere('robot-fx-smoke',{diameter:.25,segments:4},scene):MeshBuilder.CreateBox(`robot-fx-${kind}`,{size:kind==='spark'?.035:.09},scene);
    mesh.material=kind==='smoke'?smoke:kind==='debris'?metal:i%2?electric:gold;
    mesh.isPickable=false;mesh.setEnabled(false);
    return {mesh,kind,velocity:Vector3.Zero(),life:0,total:1};
  });
  let flash=0,hitAge=1,hitSide=1,deathAge=-1,high=true,emissions=0;
  const spawn=(point:Vector3,death:boolean)=>{
    emissions++;
    for(let i=0;i<particles.length;i++){
      const p=particles[i]!;
      if(!death&&(p.kind!=='spark'||i>=(high?4:2)))continue;
      if(death&&!high&&i%2)continue;
      const angle=i*2.399+emissions,speed=death?1.3: .7;
      p.mesh.position.copyFrom(point);p.mesh.visibility=1;p.mesh.scaling.setAll(1);
      if(p.kind==='spark')p.mesh.scaling.y=death?4:2;
      p.velocity.set(Math.cos(angle)*speed,.7+(i%4)*.35,Math.sin(angle)*speed);
      p.total=p.life=p.kind==='smoke'?.85:p.kind==='debris'?.7:death?.4:.18;
      p.mesh.setEnabled(true);
    }
  };
  function clearParticles(){
    flash=0;
    for(const p of particles){p.life=0;p.mesh.setEnabled(false);}
  }
  function reset(){
    clearParticles();hitAge=1;deathAge=-1;root.position.setAll(0);root.rotation.setAll(0);
    for(const {mat,emission,diffuse} of materials.values()){mat.emissiveColor.copyFrom(emission);mat.diffuseColor.copyFrom(diffuse);}
  }
  function hit(point:Vector3,side:number,killed:boolean){
    if(deathAge>=0)return;
    hitAge=0;hitSide=side<0?-1:1;flash=.11;
    if(killed){deathAge=0;flash=0;}
    spawn(point,killed);
  }
  function update(dt:number){
    if(!Number.isFinite(dt)||dt<=0)return;
    flash=Math.max(0,flash-dt);hitAge+=dt;
    if(deathAge>=0){
      deathAge+=dt;const fall=Math.min(1,deathAge/.55),eased=fall*fall*(3-2*fall);
      root.rotation.z=hitSide*1.48*eased;root.rotation.x=.12*eased;root.position.y=.4*eased;
    }else{
      const jolt=hitAge>.3?0:Math.sin(hitAge*42)*Math.exp(-hitAge*18);
      root.rotation.z=hitSide*jolt*.09;root.rotation.x=-jolt*.045;
    }
    for(const {mat,emission,diffuse,lit} of materials.values()){
      const power=deathAge<0?1:Math.max(0,1-deathAge/.16);
      mat.emissiveColor.copyFrom(emission).scaleInPlace(power);
      if(flash>0)mat.emissiveColor.addInPlace(new Color3(.18,.32,.38).scale(flash/.11));
      mat.diffuseColor.copyFrom(diffuse).scaleInPlace(lit?.12+.88*power:1);
    }
    for(const p of particles)if(p.life>0){
      p.life=Math.max(0,p.life-dt);p.mesh.setEnabled(p.life>0);
      p.mesh.position.addInPlace(p.velocity.scale(dt));
      if(p.kind==='smoke'){p.velocity.scaleInPlace(Math.exp(-dt*4));p.velocity.y=.35;p.mesh.scaling.setAll(1+(p.total-p.life)*2);p.mesh.visibility=p.life/p.total;}
      else {p.velocity.y-=dt*5;p.mesh.rotation.x+=dt*8;p.mesh.rotation.z+=dt*11;if(p.kind==='spark')p.mesh.visibility=p.life/p.total;}
    }
  }
  reset();
  return {hit,update,reset,clearParticles,setQuality(value:boolean){high=value;},get showingDeath(){return deathAge>=0&&deathAge<1.15;},
    stats:()=>({active:particles.filter(p=>p.life>0).length,dead:deathAge>=0,deathAge}),meshes:particles.map(p=>p.mesh)};
}
