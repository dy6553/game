import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import '@babylonjs/core/Engines/Extensions/engine.rawTexture.js';
import type { Scene } from '@babylonjs/core/scene.js';

export function createSurface(scene: Scene, kind: 'paving' | 'plaster' | 'road' | 'roof' | 'window') {
  const size=512, pixels=new Uint8Array(size*size*3);
  let seed=917;
  const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    let value=0.9+(noise()-0.5)*0.1;
    if(kind==='paving') {
      const row=Math.floor(y/96),column=(x+(row%2)*72)%144;
      if(y%96<3 || column<3) value=0.69;
      else value+=Math.sin(row*7+Math.floor((x+(row%2)*72)/144)*13)*0.09;
    } else if(kind==='plaster') value+=Math.sin(x*0.025)*Math.cos(y*0.025)*0.025;
    else if(kind==='road') value=0.69+noise()*0.16;
    else if(kind==='window') {
      const edge=Math.min(x,y,size-1-x,size-1-y)/size;
      value=(0.46+0.4*Math.min(1,edge*9))*(0.92+0.06*Math.sin(x*0.28));
      if(x<size*0.086 || x>size*0.914)value*=0.7;
    }
    else if(y%64<6 || (x+Math.floor(y/64)*32)%128<4) value=0.48;
    const offset=(y*size+x)*3;
    pixels[offset]=Math.round(value*246);pixels[offset+1]=Math.round(value*246);pixels[offset+2]=Math.round(value*246);
  }
  const texture=RawTexture.CreateRGBTexture(pixels,size,size,scene,true,false,Texture.TRILINEAR_SAMPLINGMODE);
  texture.anisotropicFilteringLevel=8;texture.name=`authored-${kind}`; texture.wrapU=Texture.WRAP_ADDRESSMODE; texture.wrapV=Texture.WRAP_ADDRESSMODE;
  return texture;
}

// Tangent-space normals from authored height gradients, no external image fetch.
export function createSurfaceNormals(scene:Scene,kind:'stone'|'wall'|'water'){
 const n=256,pixels=new Uint8Array(n*n*3);
 const height=(x:number,y:number)=>kind==='water'?Math.sin(x*.12+y*.19)*.3+Math.sin(x*.31-y*.11)*.15:kind==='wall'?Math.sin(x*1.7+y*.9)*.035+Math.cos(x*.27)*Math.sin(y*.3)*.06:((y%48<2||(x+Math.floor(y/48)%2*32)%64<2)?-.35:.04*Math.sin(x*.7)*Math.cos(y*.8));
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const dx=(height((x+1)%n,y)-height((x+n-1)%n,y))*.7,dy=(height(x,(y+1)%n)-height(x,(y+n-1)%n))*.7,l=Math.hypot(dx,dy,1),i=(y*n+x)*3;
  pixels[i]=Math.round((.5-dx/l*.5)*255);pixels[i+1]=Math.round((.5-dy/l*.5)*255);pixels[i+2]=Math.round((.5+.5/l)*255);
 }
 const tex=RawTexture.CreateRGBTexture(pixels,n,n,scene,true,false,Texture.TRILINEAR_SAMPLINGMODE);tex.gammaSpace=false;tex.name=`authored-normal-${kind}`;tex.anisotropicFilteringLevel=8;return tex;
}
