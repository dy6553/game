import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { Camera } from '@babylonjs/core/Cameras/camera.js';

export function createShotEffects(scene:Scene,camera:Camera) {
  const meshes:Mesh[]=[];
  const mat=(name:string,color:string,glow=false)=>{
    const m=new StandardMaterial(`fx-${name}`,scene);m.diffuseColor=Color3.FromHexString(color);
    m.specularColor.set(0.1,0.1,0.1);if(glow){m.emissiveColor=m.diffuseColor;m.disableLighting=true;}return m;
  };
  const light=mat('tracer','#ffd8a0',true),spark=mat('spark','#ffd9a0',true);
  const targetSpark=mat('target-spark','#7ee3d0',true),brass=mat('brass','#b9935f');
  const dust=mat('dust','#a59887');dust.alpha=0.17;dust.disableDepthWrite=true;
  const add=(mesh:Mesh,material:StandardMaterial)=>{
    mesh.material=material;mesh.isPickable=false;mesh.setEnabled(false);meshes.push(mesh);return mesh;
  };
  const texture=(kind:'flash'|'mark')=>{
    const size=64,data=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const u=(x+0.5-size/2)/(size/2),v=(y+0.5-size/2)/(size/2),r=Math.hypot(u,v),angle=Math.atan2(v,u);
      const i=(y*size+x)*4;
      if(kind==='flash'){
        const edge=0.25+0.65*Math.pow(Math.abs(Math.cos(angle*3)),10);
        const alpha=Math.max(0,1-r/edge);
        data[i]=255;data[i+1]=Math.round(160+95*alpha);data[i+2]=Math.round(65+170*alpha);data[i+3]=Math.round(alpha*220);
      }else{
        const grain=0.85+0.15*Math.sin(x*5.1+y*8.3);
        data[i]=40;data[i+1]=34;data[i+2]=30;
        data[i+3]=Math.round(Math.max(0,1-r)*grain*205);
      }
    }
    const tex=RawTexture.CreateRGBATexture(data,size,size,scene,false,false);tex.hasAlpha=true;tex.name=`authored-${kind}`;return tex;
  };
  const flashMat=mat('flash','#ffffff',true);flashMat.diffuseTexture=texture('flash');
  flashMat.useAlphaFromDiffuseTexture=true;flashMat.disableDepthWrite=true;flashMat.backFaceCulling=false;
  const flash=add(MeshBuilder.CreatePlane('fx-muzzle-flash',{size:0.37},scene),flashMat);flash.billboardMode=Mesh.BILLBOARDMODE_ALL;
  let flashLife=0,reduced=false;
  const markMat=mat('mark','#ffffff',true);markMat.diffuseTexture=texture('mark');
  markMat.useAlphaFromDiffuseTexture=true;markMat.disableDepthWrite=true;markMat.backFaceCulling=false;
  const traces=Array.from({length:8},()=>({mesh:add(MeshBuilder.CreateCylinder('fx-tracer',{height:1,diameter:0.018,tessellation:6},scene),light),start:Vector3.Zero(),end:Vector3.Zero(),direction:Vector3.Forward(),distance:0,travel:0,active:false}));
  const particles=Array.from({length:48},()=>({mesh:add(MeshBuilder.CreateSphere('fx-spark',{diameter:0.025,segments:4},scene),spark),velocity:Vector3.Zero(),life:0}));
  const marks=Array.from({length:24},()=>({mesh:add(MeshBuilder.CreatePlane('fx-impact-mark',{size:0.15},scene),markMat),life:0}));
  const shells=Array.from({length:12},()=>({mesh:add(MeshBuilder.CreateCylinder('fx-shell',{diameter:0.022,height:0.07,tessellation:8},scene),brass),velocity:Vector3.Zero(),life:0,bounced:false}));
  const clouds=Array.from({length:6},()=>({mesh:add(MeshBuilder.CreateSphere('fx-impact-dust',{diameter:0.12,segments:6},scene),dust),life:0}));
  let traceIndex=0,sparkIndex=0,markIndex=0,shellIndex=0,cloudIndex=0,emitted=0;
  function emit(start:Vector3,end:Vector3,normal:Vector3,impact:boolean,target:boolean,primary=true) {
    emitted++;if(primary){flashLife=!reduced&&Vector3.DistanceSquared(start,camera.position)>.25?.045:0;flash.position.copyFrom(start);flash.setEnabled(flashLife>0);}
    const trace=traces[traceIndex++%traces.length]!;
    trace.start.copyFrom(start);
    end.subtractToRef(start,trace.direction);
    trace.distance=trace.direction.length();trace.direction.normalize();
    trace.travel=0;trace.active=true;
    trace.mesh.rotationQuaternion??=new Quaternion();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(),trace.direction,trace.mesh.rotationQuaternion);
    trace.mesh.position.copyFrom(start);trace.mesh.scaling.y=0.01;trace.mesh.setEnabled(true);
    if(primary&&!reduced){const shell=shells[shellIndex++%shells.length]!;
    shell.mesh.position.copyFrom(start);shell.mesh.position.y-=0.1;shell.mesh.setEnabled(true);shell.life=1.1;shell.bounced=false;
    shell.velocity=camera.getDirection(Vector3.Right()).scale(1.3).add(new Vector3(0,1.05,0));
    }
    if(!impact)return;
    const n=normal.lengthSquared()>0.1?normal.normalizeToNew():trace.direction.scale(-1);
    const right=Vector3.Cross(n,Math.abs(n.y)>0.9?Vector3.Right():Vector3.Up()).normalize();
    const up=Vector3.Cross(n,right).normalize();
    const sparkPosition=end.add(n.scale(.025));
    for(let i=0;i<(reduced?2:6);i++) {
      const p=particles[sparkIndex++%particles.length]!,angle=i*2.4+emitted;
      p.mesh.position.copyFrom(sparkPosition);p.mesh.material=target?targetSpark:spark;
      p.velocity=n.scale(0.6+i*0.1).add(right.scale(Math.cos(angle)*0.8)).add(up.scale(Math.sin(angle)*0.8));
      p.life=0.15+(i%3)*0.035;p.mesh.setEnabled(true);
    }
    if(!target&&!reduced) {
      const mark=marks[markIndex++%marks.length]!;mark.life=9;mark.mesh.position.copyFrom(end.add(n.scale(0.012)));
      mark.mesh.rotationQuaternion=new Quaternion();Quaternion.FromUnitVectorsToRef(Vector3.Forward(),n,mark.mesh.rotationQuaternion);mark.mesh.setEnabled(true);
      const cloud=clouds[cloudIndex++%clouds.length]!;cloud.life=0.28;cloud.mesh.position.copyFrom(end.add(n.scale(0.06)));
      cloud.mesh.scaling.setAll(1);cloud.mesh.visibility=1;cloud.mesh.setEnabled(true);
    }
  }
  function update(dt:number) {
    if(flashLife>0){
      flashLife-=dt;
      if(flashLife<=0)flash.setEnabled(false);
    }
    for(const trace of traces)if(trace.active) {
      trace.travel+=dt*800;
      const head=Math.min(trace.distance,trace.travel+0.2),tail=Math.max(0,head-2.2),length=Math.max(0.01,head-tail);
      const center=(head+tail)/2;
      trace.mesh.position.set(trace.start.x+trace.direction.x*center,trace.start.y+trace.direction.y*center,trace.start.z+trace.direction.z*center);
      trace.mesh.scaling.y=length;
      if(trace.travel>trace.distance+2.2){trace.active=false;trace.mesh.setEnabled(false);}
    }
    for(const p of particles)if(p.life>0){p.life-=dt;p.mesh.setEnabled(p.life>0);p.mesh.position.addInPlace(p.velocity.scale(dt));p.velocity.y-=3*dt;}
    for(const mark of marks)if(mark.life>0){mark.life-=dt;mark.mesh.setEnabled(mark.life>0);}
    for(const shell of shells)if(shell.life>0){
      shell.life-=dt;shell.mesh.setEnabled(shell.life>0);shell.velocity.y-=9*dt;
      shell.mesh.position.addInPlace(shell.velocity.scale(dt));shell.mesh.rotation.x+=dt*12;shell.mesh.rotation.z+=dt*9;
      if(shell.mesh.position.y<0.08){shell.mesh.position.y=0.08;if(!shell.bounced){shell.velocity.y=Math.abs(shell.velocity.y)*0.2;shell.velocity.x*=0.4;shell.velocity.z*=0.4;shell.bounced=true;}else shell.velocity.setAll(0);}
    }
    for(const cloud of clouds)if(cloud.life>0){cloud.life-=dt;cloud.mesh.setEnabled(cloud.life>0);cloud.mesh.scaling.setAll(1+(0.28-cloud.life)*4);cloud.mesh.visibility=Math.max(0,cloud.life/0.28);}
  }
  function clear() {
    for(const mesh of meshes){mesh.setEnabled(false);mesh.visibility=1;}
    for(const t of traces)t.active=false;
    for(const item of [...particles,...marks,...shells,...clouds])item.life=0;
    flashLife=0;emitted=0;
  }
  function setReduced(value:boolean){
    if(reduced===value)return;
    reduced=value;
    if(!reduced)return;
    flashLife=0;flash.setEnabled(false);
    for(const decoration of [...marks,...shells,...clouds])if(decoration.life>0){
      decoration.life=0;decoration.mesh.setEnabled(false);
    }
  }
  return {emit,update,clear,meshes,setReduced,stats:()=>({emitted,traces:traces.filter(t=>t.active).length,marks:marks.filter(m=>m.life>0).length,sparks:particles.filter(p=>p.life>0).length,shells:shells.filter(s=>s.life>0).length})};
}
