import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import '@babylonjs/core/Engines/Extensions/engine.rawTexture.js';
import type { Scene } from '@babylonjs/core/scene.js';

export function createSurface(scene: Scene, kind: 'paving' | 'plaster' | 'road' | 'roof' | 'window' | 'wood' | 'interior-wood') {
  const size=kind==='interior-wood'?256:1024, pixels=new Uint8Array(size*size*3);
  let seed=917;
  const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    let value=0.9+(noise()-0.5)*0.1;
    if(kind==='wood'){value=.65+.1*Math.sin(y*.05+Math.sin(x*.015)*3)+.05*Math.sin(y*.4);if(y%96<3)value=.28;}
    else if(kind==='interior-wood'){
      const board=Math.floor(y/64);
      value=y%64<2?.73:.81+(board%2?.025:0)+(noise()-.5)*.025;
    }
    else if(kind==='paving') {
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

export function createLunarDust(scene:Scene,size:number,withRelief:boolean){
 const diffuse=new Uint8Array(size*size*3);
 const heights=withRelief?new Float32Array(size*size):undefined;
 const random=(x:number,y:number)=>{
  let n=Math.imul(x+17,0x1f123bb5)^Math.imul(y+31,0x6a09e667);
  n=Math.imul(n^(n>>>15),0x45d9f3b);
  return ((n^(n>>>16))>>>0)/0xffffffff;
 };
 function noise(u:number,v:number,cells:number){
  const x=u*cells,y=v*cells,ix=Math.floor(x),iy=Math.floor(y);
  const tx=x-ix,ty=y-iy,s=tx*tx*(3-2*tx),t=ty*ty*(3-2*ty);
  const a=random(ix,iy),b=random((ix+1)%cells,iy),c=random(ix,(iy+1)%cells),d=random((ix+1)%cells,(iy+1)%cells);
  return a+(b-a)*s+(c-a+(d-c-b+a)*s)*t;
 }
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,grain=random(x,y),fine=noise(u,v,24);
  const dust=.45*noise(u,v,4)+.34*noise(u,v,11)+.21*fine;
  const chips=Math.max(0,fine-.72)*.9;
  const value=Math.min(255,Math.round(200+dust*48+grain*12-chips*68));
  const index=y*size+x,i=index*3;
  diffuse[i]=value;diffuse[i+1]=value;diffuse[i+2]=value-2;
  if(heights)heights[index]=dust*.38+chips+.028*grain;
 }
 function texture(bytes:Uint8Array,name:string){
  const map=RawTexture.CreateRGBTexture(bytes,size,size,scene,true,false,Texture.TRILINEAR_SAMPLINGMODE);
  map.name=name;map.wrapU=map.wrapV=Texture.WRAP_ADDRESSMODE;
  return map;
 }
 const albedo=texture(diffuse,'lunar-dust-albedo');
 if(!heights)return {albedo,normal:null,bytes:diffuse.byteLength};
 const relief=new Uint8Array(diffuse.length);
 const at=(x:number,y:number)=>heights[((y+size)%size)*size+(x+size)%size]!;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const dx=at(x+1,y)-at(x-1,y),dy=at(x,y+1)-at(x,y-1);
  const length=Math.hypot(dx,dy,1),i=(y*size+x)*3;
  relief[i]=Math.round(127.5*(1-dx/length));
  relief[i+1]=Math.round(127.5*(1-dy/length));
  relief[i+2]=Math.round(127.5*(1+1/length));
 }
 const normal=texture(relief,'lunar-dust-normal');
 normal.gammaSpace=false;
 return {albedo,normal,bytes:diffuse.byteLength+relief.byteLength};
}
