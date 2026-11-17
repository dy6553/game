import {ParticleSystem} from '@babylonjs/core/Particles/particleSystem.js';
import {RawTexture} from '@babylonjs/core/Materials/Textures/rawTexture.js';
import {Color4} from '@babylonjs/core/Maths/math.color.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import type {Scene} from '@babylonjs/core/scene.js';
import type {Point} from './world.ts';

// Ambient snow is visual only. Storm visibility and AI perception are separate rules.
export function createSnowfall(scene:Scene){
 const capacity=160,origin=new Vector3(0,6,0),system=new ParticleSystem('ambient-snow',capacity,scene);
 const size=32,pixels=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const r=Math.hypot((x+.5-size/2)/(size/2),(y+.5-size/2)/(size/2));
  const i=(y*size+x)*4;
  pixels[i]=pixels[i+1]=pixels[i+2]=255;
  pixels[i+3]=Math.round(Math.max(0,1-r)*220);
 }
 system.particleTexture=RawTexture.CreateRGBATexture(pixels,size,size,scene,false,false);
 system.particleTexture.name='snowflake-32px';
 system.emitter=origin;
 const wind1=new Vector3(-.09,-1,.025),wind2=new Vector3(.03,-1,.075);
 system.createBoxEmitter(wind1,wind2,new Vector3(-8,-1,-8),new Vector3(8,3,8));
 system.minSize=.07;system.maxSize=.20;
 system.minLifeTime=4;system.maxLifeTime=7;
 system.minEmitPower=1.1;system.maxEmitPower=1.6;
 system.gravity=new Vector3(0,-.12,0);
 system.color1=new Color4(.96,.98,1,.95);system.color2=new Color4(.9,.95,1,.8);
 system.colorDead=new Color4(.9,.95,1,0);
 system.blendMode=ParticleSystem.BLENDMODE_STANDARD;
 system.updateSpeed=.02;
 let running=false,disposed=false,high=false,low=false,storm=0;
 function apply(){system.emitRate=(high?28:low?7:16)+storm*(high?72:48);wind1.set(-.09-storm*2.5,-1,.025+storm*.3);wind2.set(.03-storm*1.6,-1,.075+storm*.4);system.maxEmitPower=1.6+storm*1.8;system.maxSize=.2+storm*.08;}
 function stop(){if(running){system.stop();system.reset();running=false;}}
 apply();
 scene.onDisposeObservable.addOnce(()=>{disposed=true;running=false;});
 return {
  update(p:Point,enabled:boolean,yaw=0){
   if(disposed)return;
   if(!enabled){stop();return;}
   origin.set(p.x+Math.sin(yaw)*5,(p.y??0)+3.5,p.z+Math.cos(yaw)*5);
   if(!running){system.start();running=true;}
  },
  stop,
  setStormIntensity(value:number){const next=Math.max(0,Math.min(1,value));if(Math.abs(next-storm)>.001){storm=next;apply();}},
  setQuality(value:boolean){high=value;apply();},
  setLow(value:boolean){low=value;apply();},
  state:()=>({running,capacity,emitRate:system.emitRate,profile:high?'high':low?'low':'medium',textureSize:size}),
 };
}
