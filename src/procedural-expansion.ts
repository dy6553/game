import {createLunarDust} from './surfaces.ts';
import {moonCorridor,moonCorridorSections,moonCrater,moonShelters,moonMaskRacks,moonExteriorAirlocks} from './moon-layout.ts';
import {snowShells,snowShellIds,snowEntryGalleries} from './igloo-layout.ts';
import type {Scene} from '@babylonjs/core/scene.js';
import {Mesh} from '@babylonjs/core/Meshes/mesh.js';
import {VertexData} from '@babylonjs/core/Meshes/mesh.vertexData.js';
import '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import '@babylonjs/core/Meshes/Builders/planeBuilder.js';
import '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode.js';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial.js';
import {RawTexture} from '@babylonjs/core/Materials/Textures/rawTexture.js';
import {Texture} from '@babylonjs/core/Materials/Textures/texture.js';
import {Color3} from '@babylonjs/core/Maths/math.color.js';
import {Matrix,Quaternion,Vector3} from '@babylonjs/core/Maths/math.vector.js';
import type {ShadowGenerator} from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import type {World} from './world.ts';
import type {ExpansionMapId} from './maps.ts';
import type {ExpansionQuality} from './expansion-map-art.ts';

export const EXPANSION_PROFILES={low:{segments:8,ground:12,terrain:24,texture:64,details:0},medium:{segments:16,ground:24,terrain:36,texture:128,details:1},high:{segments:28,ground:40,terrain:52,texture:256,details:2}} as const;
type Batch={positions:number[];normals:number[];indices:number[];uvs:number[];colors:number[];material:number};
export type ProceduralMapState={source:'procedural';map:ExpansionMapId;quality:ExpansionQuality;triangles:number;meshCount:number;textureBytes:number;collisionCount:number;landmarks:string[]};
const color=(hex:string)=>Color3.FromHexString(hex),hash=(x:number,z:number)=>{const t=Math.sin(x*127.1+z*311.7)*43758.5453;return t-Math.floor(t);};
const FONT:Record<string,string>={F:'11111100001000011110100001000010000',A:'01110100011000111111100011000110001',B:'11110100011000111110100011000111110',C:'01111100001000010000100001000001111',D:'11110100011000110001100011000111110',E:'11111100001000011110100001000011111',H:'10001100011000111111100011000110001',I:'11111001000010000100001000010011111',L:'10000100001000010000100001000011111',N:'10001110011010110011100011000110001',O:'01110100011000110001100011000101110',P:'11110100011000111110100001000010000',R:'11110100011000111110101001001010001',S:'01111100001000001110000010000111110',T:'11111001000010000100001000010000100',U:'10001100011000110001100011000101110','0':'01110100011001110101110011000101110','1':'00100011000010000100001000010001110','2':'01110100010000100010001000100011111','-':'00000000000000011111000000000000000'};
function signTexture(scene:Scene){const w=128,h=64,p=new Uint8Array(w*h*3),labels=['OBS 01','A1 LAB','A2 LAB','HAB 01','OPS 02','2F','PAD 01','O2'];labels.forEach((text,index)=>{const ox=index%2*64,oy=Math.floor(index/2)*16;for(let y=0;y<16;y++)for(let x=0;x<64;x++){const i=((h-1-oy-y)*w+ox+x)*3;p[i]=12;p[i+1]=36;p[i+2]=45;}for(let k=0;k<text.length;k++){const glyph=FONT[text[k]!]??'0'.repeat(35);for(let y=0;y<7;y++)for(let x=0;x<5;x++)if(glyph[y*5+x]==='1'){const i=((h-1-oy-4-y)*w+ox+4+k*6+x)*3;p[i]=210;p[i+1]=238;p[i+2]=226;}}});const t=RawTexture.CreateRGBTexture(p,w,h,scene,false,false,Texture.NEAREST_SAMPLINGMODE);t.name='procedural-map-signs';return t;}


function shellFace(points:readonly (readonly number[])[],center:readonly number[],inset=1,lift=0){
 const mid=[0,1,2].map(axis=>points.reduce((sum,p)=>sum+p[axis]!,0)/points.length);
 const positions=points.flatMap(p=>p.map((x,axis)=>mid[axis]!+(x-mid[axis]!)*inset));let indices=[0,1,2,0,2,3],normals:number[]=[];
 VertexData.ComputeNormals(positions,indices,normals);const toward=mid.map((x,i)=>x-center[i]!);
 if(normals[0]!*toward[0]!+normals[1]!*toward[1]!+normals[2]!*toward[2]!<0){indices=[0,2,1,0,3,2];normals=[];VertexData.ComputeNormals(positions,indices,normals);}
 if(lift)for(let i=0;i<positions.length;i++)positions[i]=positions[i]!+normals[i]!*lift;
 const v=new VertexData();v.positions=positions;v.indices=indices;v.normals=normals;v.uvs=[0,0,1,0,1,1,0,1];return v;
}

export function shellGeometry(vertices:readonly (readonly number[])[]){
 const center=[0,1,2].map(axis=>vertices.reduce((sum,p)=>sum+p[axis]!,0)/8),result=new VertexData(),positions:number[]=[],normals:number[]=[],uvs:number[]=[],indices:number[]=[];
 for(const face of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]]){const v=shellFace(face.map(i=>vertices[i]!),center),offset=positions.length/3;positions.push(...v.positions!);normals.push(...v.normals!);uvs.push(...v.uvs!);for(const i of v.indices!)indices.push(i+offset);}
 result.positions=positions;result.normals=normals;result.uvs=uvs;result.indices=indices;return result;
}

const SHELL_FACES=[[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]];
const shellFaceKey=(points:readonly (readonly number[])[])=>points.map(p=>p.map(n=>Math.round(n*1e6)).join(',')).sort().join(';');
const shellFaceCounts=new Map<string,number>();
for(const shell of snowShells)for(const face of SHELL_FACES){const key=shellFaceKey(face.map(i=>shell.vertices[i]!));shellFaceCounts.set(key,(shellFaceCounts.get(key)??0)+1);}

const REGOLITH=4,BASALT=5;

export function createProceduralExpansion(scene:Scene,map:ExpansionMapId,world:World,shadows?:ShadowGenerator,rackSeed=1){
 let high=false,low=false,sheltered=false,root:TransformNode|undefined,owned:StandardMaterial[]=[],textures:RawTexture[]=[],meshes:Mesh[]=[],state:ProceduralMapState;
 const snow=map==='snow',bounds=world.PROTOTYPE;
 function release(){for(const m of meshes)shadows?.removeShadowCaster(m,false);root?.dispose();meshes=[];for(const m of owned)m.dispose();for(const t of textures)t.dispose();owned=[];textures=[];root=undefined;}
 function build(quality:ExpansionQuality,refresh=false){
  if(scene.isDisposed||(!refresh&&state?.quality===quality))return;release();const profile=EXPANSION_PROFILES[quality],batches=new Map<string,Batch>();
  root=new TransformNode(`${map}-procedural-${quality}`,scene);
  const surface=new StandardMaterial('procedural-map-surface',scene);surface.diffuseColor=Color3.White();surface.specularColor=new Color3(.035,.035,.035);surface.ambientColor=new Color3(.22,.22,.22);surface.emissiveColor=new Color3(.07,.075,.08);surface.maxSimultaneousLights=2;
  const grain=new Uint8Array(profile.texture*profile.texture*3);for(let i=0;i<grain.length;i+=3){const v=246+Math.floor(hash((i/3)%profile.texture,Math.floor(i/3/profile.texture))*9);grain[i]=grain[i+1]=grain[i+2]=v;}
  const texture=RawTexture.CreateRGBTexture(grain,profile.texture,profile.texture,scene,true,false,Texture.BILINEAR_SAMPLINGMODE);texture.name='procedural-map-grain';texture.anisotropicFilteringLevel=quality==='low'?1:quality==='medium'?2:4;surface.diffuseTexture=texture;
  const glow=new StandardMaterial('procedural-map-inlay',scene);glow.diffuseColor=Color3.White();glow.emissiveColor=new Color3(.55,.55,.55);glow.specularColor=Color3.Black();glow.maxSimultaneousLights=1;
  const sky=new StandardMaterial('procedural-map-sky',scene);sky.disableLighting=true;sky.emissiveColor=Color3.White();sky.diffuseColor=Color3.White();sky.specularColor=Color3.Black();sky.backFaceCulling=false;
  const signs=new StandardMaterial('procedural-map-sign',scene);const atlas=signTexture(scene);signs.diffuseTexture=atlas;signs.emissiveTexture=atlas;signs.emissiveColor=new Color3(.3,.3,.3);signs.specularColor=Color3.Black();
  owned=[surface,glow,sky,signs];textures=[texture,atlas];
  let lunarTextureBytes=0;
  if(!snow){
   const dust=createLunarDust(scene,profile.texture,quality==='high');
   textures.push(dust.albedo);
   if(dust.normal)textures.push(dust.normal);
   lunarTextureBytes=dust.bytes;
   for(const name of ['lunar-regolith','lunar-basalt']){
    const material=new StandardMaterial(name,scene);
    const rock=name==='lunar-basalt';
    material.diffuseColor=rock?new Color3(.84,.86,.92):Color3.White();
    material.specularColor=rock?new Color3(.025,.027,.03):Color3.Black();
    material.specularPower=rock?18:64;
    material.ambientColor=new Color3(.22,.22,.22);
    material.emissiveColor=new Color3(.067,.073,.082);
    material.maxSimultaneousLights=2;
    material.diffuseTexture=dust.albedo;
    material.bumpTexture=dust.normal;
    owned.push(material);
   }
  }
  const materials=owned;
  function add(v:VertexData,x:number,y:number,z:number,tint:string,material=0,yaw=0,pitch=0,roll=0,scale:Vector3=new Vector3(1,1,1),special?:string){
   const key=special??(material===0?`${Math.max(0,Math.min(Math.ceil(bounds.halfWidth*2/40)-1,Math.floor((x+bounds.halfWidth)/40)))},${Math.max(0,Math.min(Math.ceil((bounds.maxZ+bounds.halfDepth)/40)-1,Math.floor((z+bounds.halfDepth)/40)))}`:'global');
   const indoors=snow&&(special==='shelter'||(!special&&world.indoorAt({x,y,z})));
   const id=material+':'+(indoors?'shelter:':'')+key;let b=batches.get(id);if(!b){b={positions:[],normals:[],indices:[],uvs:[],colors:[],material};batches.set(id,b);}const offset=b.positions.length/3,c=color(tint),matrix=Matrix.Compose(scale,Quaternion.RotationYawPitchRoll(yaw,pitch,roll),new Vector3(x,y,z));
   const p=v.positions!,n=v.normals!,out=new Vector3(),norm=new Vector3();for(let i=0;i<p.length;i+=3){Vector3.TransformCoordinatesFromFloatsToRef(p[i]!,p[i+1]!,p[i+2]!,matrix,out);Vector3.TransformNormalFromFloatsToRef(n[i]!,n[i+1]!,n[i+2]!,matrix,norm);norm.normalize();b.positions.push(out.x,out.y,out.z);b.normals.push(norm.x,norm.y,norm.z);const j=i/3*4;b.colors.push(v.colors?.[j]??c.r,v.colors?.[j+1]??c.g,v.colors?.[j+2]??c.b,1);b.uvs.push(v.uvs?.[i/3*2]??0,v.uvs?.[i/3*2+1]??0);}for(const i of v.indices!)b.indices.push(i+offset);
  }
  function box(x:number,y:number,z:number,w:number,h:number,d:number,c:string,mat=0,yaw=0){add(VertexData.CreateBox({width:w,height:h,depth:d}),x,y,z,c,mat,yaw);}
  function cylinder(x:number,y:number,z:number,r:number,h:number,c:string,mat=0){add(VertexData.CreateCylinder({diameter:r*2,height:h,tessellation:profile.segments}),x,y,z,c,mat);}
  function dome(x:number,y:number,z:number,r:number,c:string){add(VertexData.CreateSphere({diameter:r*2,segments:profile.segments,slice:.5}),x,y,z,c);}
  function label(x:number,y:number,z:number,index:number,yaw=0,pitch=0,width=3.2,height=.8){const v=VertexData.CreatePlane({width,height,sideOrientation:Mesh.DOUBLESIDE});const u=index%2*.5,t=Math.floor(index/2)*.25;v.uvs=v.uvs!.map((a,i)=>i%2?1-t-.25+a*.25:u+a*.5);add(v,x,y,z,'#ffffff',3,yaw,pitch);}
  const white=snow?'#d6e7ea':'#c6cfd2',dark=snow?'#284958':'#35404e',accent=snow?'#278c99':'#b79a55',warm='#e9a35d';
  // Exact shared rectangles are the visual foundation at all three levels.
  for(const r of snow?world.worldSolids():world.shotBoxes()){
   if(snow&&(snowShellIds.has(r.id)||r.id==='igloo-central-pillar'))continue;
   const min=r.yMin??0,max=r.yMax??r.height??2,wall=/wall|lintel/.test(r.id),roof=r.id.endsWith(' roof'),isDark=!snow&&r.id.startsWith('Operations');
   const lunarRoom=!snow?world.BUILDINGS.find(b=>r.id.startsWith(b.id)):undefined;
   const roomTint=(lunarRoom?.x??0)>0?'#8197a5':'#6e889f';
   const floor=r.id.includes('floor-observation')||r.id.includes('stair-step');
   const lunarRock=!snow&&/basalt|moon-crater/.test(r.id);
   const tint=floor?roomTint:lunarRoom&&wall?roomTint:wall?(isDark?dark:white):roof?(snow?'#edf3f1':dark):lunarRock?'#626674':/console|igloo-workbench/.test(r.id)?dark:/support/.test(r.id)?dark:accent;
   if(lunarRoom&&wall){
    const liner=color('#a9c4d3'),shell=color('#e6e4d9'),edge=color('#607382');
    const mesh=VertexData.CreateBox({width:r.width,height:max-min,depth:r.depth});
    mesh.colors=[];
    for(let i=0;i<mesh.normals!.length;i+=3){
     const nx=mesh.normals![i]!,nz=mesh.normals![i+2]!;
     const facing=nx*(r.x-lunarRoom.x)+nz*(r.z-lunarRoom.z);
     const paint=facing>.4?shell:facing<-.4?liner:edge;
     mesh.colors.push(paint.r,paint.g,paint.b,1);
    }
    add(mesh,r.x,(min+max)/2,r.z,'#ffffff');
   }else if(lunarRock){
    const mesh=VertexData.CreateBox({width:r.width,height:max-min,depth:r.depth});
    const base=color(tint);
    mesh.colors=[];
    for(let i=0;i<mesh.normals!.length;i+=3){
     const shade=.72+.23*Math.max(0,mesh.normals![i+1]!)+.12*hash(r.x+mesh.positions![i]!,r.z+mesh.positions![i+2]!);
     mesh.colors.push(base.r*shade,base.g*shade,base.b*shade,1);
    }
    add(mesh,r.x,(min+max)/2,r.z,tint,BASALT);
   }else box(r.x,(min+max)/2,r.z,r.width,max-min,r.depth,tint);
   if(wall&&min===0&&!r.id.startsWith('moon-link')){
    // Inlays stay on solid walls; never bridge a walkable opening.
    const wide=r.width>r.depth,length=wide?r.width:r.depth;
    for(const side of [-1,1]){const x=r.x+(wide?0:side*(r.width/2+.006)),z=r.z+(wide?side*(r.depth/2+.006):0);
     box(x,.42,z,wide?length:.015,.32,wide?.015:length,dark);
     box(x,Math.min(3.6,max-.3),z,wide?length:.018,.23,wide?.018:length,accent);
     if(length>4&&(snow||profile.details>0)){const count=Math.floor((length-1)/5);for(let i=0;i<count;i++){const offset=(i-(count-1)/2)*5;box(x+(wide?offset:0),2.1,z+(wide?0:offset),wide?3:.022,.7,wide?.022:3,'#345668');if(profile.details>0)box(x+(wide?offset:0),2.5,z+(wide?0:offset),wide?3.15:.032,.07,wide?.032:3.15,white);}}
    }
   }
   if(/lintel/.test(r.id)){const wide=r.width>r.depth;box(r.x,min+.1,r.z,wide?r.width:.54,.12,wide?.54:r.depth,warm,1);}
   if(!wall&&!roof&&!floor&&!/support|basalt|moon-crater/.test(r.id)){
    box(r.x,max+.012,r.z,r.width*.8,.024,r.depth*.75,dark);box(r.x,max*.65,r.z-r.depth/2-.012,r.width*.65,.18,.025,warm,1);
    if(profile.details>0){for(const side of [-1,1])box(r.x+side*r.width*.38,(min+max)/2,r.z,.065,(max-min)*.9,r.depth*1.01,white);}
   }
  }
  // Flat paths and room floors add no obstacles or different sightlines.
  for(const [i,b] of world.BUILDINGS.entries()){
   if(snow)continue;
   box(b.x,.018,b.z,b.width-.5,.03,b.depth-.5,'#536d7f');
   box(b.x,.038,b.z,1.2,.012,b.depth-.7,'#718ca0');
   for(const side of [-1,1]){
    box(b.x, b.height+.48,b.z+side*(b.depth/2-.25),b.width,.06,.25,white);
    label(b.x+(b.width/2+3)/2,3.45,b.z+side*(b.depth/2+.28),i===0?3:i===1?4:7,side===-1?0:Math.PI,0,Math.min(3.2,(b.width-6)/2-.2));
    box(b.x,.025,b.z+side*(b.depth/2+2),2.8,.025,3.6,dark);
    for(const x of [-1,1])box(b.x+x*1.3,.046,b.z+side*(b.depth/2+2),.11,.018,3.6,warm,1);
   }
   if(profile.details>0){const count=profile.details===2?8:4;for(let j=0;j<count;j++){
    const x=b.x-b.width*.4+b.width*.8*j/(count-1);box(x,b.height+.5,b.z,.08,.05,b.depth*.92,dark);
   }}
  }
  function grid(terrain:boolean){const n=terrain?profile.terrain:profile.ground,w=bounds.halfWidth*2,d=bounds.maxZ+bounds.halfDepth,p:number[]=[],c:number[]=[],uv:number[]=[],indices:number[]=[];
   const margin=terrain?110:20;
   const edgePadding=Math.max(w,d)/n+margin*2/n+1;
   for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
    const x=(i/n-.5)*(w+margin*2),z=(j/n-.5)*(d+margin*2),outside=Math.max(Math.abs(x)-w/2,Math.abs(z)-d/2),e=Math.max(0,outside-3);
    const angle=Math.atan2(z,x);
    const ridgeDistance=23+9*Math.cos(angle*3)+5*Math.sin(angle*7);
    const ridge=Math.max(0,1-Math.abs(e-ridgeDistance)/19);
    const fine=hash(Math.floor(x/12),Math.floor(z/12));
    const rise=Math.min(1,Math.max(0,outside-edgePadding)/13);
    const y=terrain?(snow?Math.min(1,e/20)*(7+Math.pow(hash(Math.floor(x/18),Math.floor(z/18)),2)*34)+Math.sin(x*.045)*Math.cos(z*.04)*Math.min(e*.15,6):-.045+rise*(2+fine*3+ridge*(9+fine*7))):-.012;
    let col=snow?new Color3(.72,.82,.87):new Color3(.43,.43,.435);
    if(terrain){const v=hash(Math.floor(x/10),Math.floor(z/10));col=snow?(y>22?new Color3(.83,.88,.89):new Color3(.30+v*.12,.41+v*.12,.49+v*.12)):new Color3(.25+v*.12,.247+v*.12,.263+v*.12);}
    else if(!snow){for(const [cx,cz,r] of [[-12,25,8],[13,-26,7],[0,0,14]]){const q=Math.hypot(x-cx!,z-cz!)/r!;if(q<1.3&&q>.75)col=col.scale(1.22);else if(q<.75)col=col.scale(.82);}col=col.scale(.91+hash(i,j)*.13+.055*Math.cos(x*.083+z*.057));}
    else col=col.scale(.97+hash(i,j)*.05);
    p.push(x,y,z);c.push(col.r,col.g,col.b,1);const tile=snow?.08:.19;uv.push(x*tile,z*tile);
   }
   for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=((i+.5)/n-.5)*(w+margin*2),z=((j+.5)/n-.5)*(d+margin*2);const dx=(w+margin*2)/n/2,dz=(d+margin*2)/n/2;if(terrain&&Math.abs(x)-dx<w/2+3&&Math.abs(z)-dz<d/2+3)continue;const a=j*(n+1)+i,b=a+1,k=a+n+1;indices.push(a,b,k,b,k+1,k);}
   const normals:number[]=[];VertexData.ComputeNormals(p,indices,normals);const v=new VertexData();v.positions=p;v.normals=normals;v.indices=indices;v.uvs=uv;v.colors=c;
   add(v,0,0,0,'#ffffff',snow?0:REGOLITH,0,0,0,new Vector3(1,1,1),terrain?'landscape':'ground');
  }
  grid(false);grid(true);
  const landmarks=snow?['observatory','mountain-ridge','igloo-hub','arched-laboratories','heated-links']:['habitat-dome','communications-dish','landing-pad','earth','airlock-link','crater-route'];
  if(snow){
   for(const side of [-1,1]){
    box(0,.012,side*28,3.4,.014,28,'#aebfc5');
    for(const x of [-1,1])box(x*1.85,.021,side*28,.08,.012,28,accent);
    if(profile.details>0)for(let i=0;i<14;i++)box((i%2?-.35:.35),.024,side*(17+i*1.6),.18,.008,.38,'#94acb5',0,side*.2);
   }
   for(const piece of snowShells){
    const center=[0,1,2].map(axis=>piece.vertices.reduce((sum,p)=>sum+p[axis]!,0)/8);
    for(const [faceIndex,face] of SHELL_FACES.entries()){
     // Lab cap tops are inside the existing vault roof, on the same plane.
     if(faceIndex===3&&piece.id.includes('end-wall'))continue;
     // Omit the ring cap where a tunnel is welded to a portal. The portal
     // already owns this plane; drawing both causes depth flicker.
     if(faceIndex===2||faceIndex===3){
      const end=faceIndex===2?piece.vertices[0]!:piece.vertices[3]!;
      if(piece.id.startsWith('igloo-link-')||(/^igloo-entry-/.test(piece.id)&&Math.abs(Math.abs(end[2]!)-15.1)<.001)||(/laboratory entry-/.test(piece.id)&&Math.abs(Math.abs(end[2]!)-26)<.001)||(/laboratory shell-/.test(piece.id)&&Math.abs(Math.abs(end[2]!)-26)<.001))continue;
     }
     const points=face.map(i=>piece.vertices[i]!);if((shellFaceCounts.get(shellFaceKey(points))??0)>1)continue;add(shellFace(points,center),0,0,0,'#c7d7e1',0,0,0,0,undefined,'shelter');
     if(face[0]===0&&face[1]===1)add(shellFace(points,center,.985,.016),0,0,0,'#edf1ed',0,0,0,0,undefined,'shelter');
     if(face[0]===4)add(shellFace(points,center,.988,.016),0,0,0,'#edf3f4',0,0,0,0,undefined,'shelter');
    }
   }
   add(VertexData.CreateCylinder({diameter:2,height:.025,tessellation:32}),0,.008,0,'#d3e4ed',0,0,0,0,new Vector3(17,1,14));
   for(const b of world.BUILDINGS.slice(1))box(b.x,.012,0,10.4,.025,51,'#c9dce4');
   for(const entry of snowEntryGalleries){
    const floor=VertexData.CreateBox({width:(entry.radius-.54)*2,height:.025,depth:entry.end-entry.floorStart});
    for(const side of [-1,1])add(floor,entry.x,.015,side*(entry.floorStart+entry.end)/2,'#a0b1af',0,0,0,0,undefined,'shelter');
   }
   for(const side of [-1,1]){
    box(side*22.25,.015,0,11,.025,5.3,'#a0b1af');
    label(0,3.5,side*21.04,0,side<0?0:Math.PI,0,2.2,.45);
    for(const b of world.BUILDINGS.slice(1))label(b.x,3.3,side*30.96,b.x>0?1:2,side<0?0:Math.PI,0,1.8,.35);
    // Warm opaque inlays: a light source appearance without extra dynamic lights.
    box(0,3.65,side*13.17,4.5,.10,.05,warm,1);
    for(const b of world.BUILDINGS.slice(1))box(b.x,5.35,side*10,.13,.10,8,warm,1);
   }
   // Warm ceiling inlays, a recessed floor guide and readable workstation faces.
   // All details join existing opaque batches; no new lights or transparent layers.
   const ring=quality==='low'?16:32;
   for(let i=0;i<ring;i++){
    const a=i/ring*Math.PI*2,x=Math.cos(a)*12.45,z=Math.sin(a)*10.3;
    box(x,7.15,z,.65,.075,.13,warm,1,-a);
   }
   box(0,4.4,0,2.4,8.8,2.4,'#e4edf0');box(0,6.1,-1.211,2.2,.12,.02,'#56d8df',1);box(0,6.1,1.211,2.2,.12,.02,'#56d8df',1);
   for(const side of [-1,1]){
    for(const z of [-2,7]){
     box(side*6,.72,z-.616,1.9,.42,.018,'#152f3b');
     box(side*6,.75,z-.629,1.55,.22,.008,'#7bb5b7',1);
     box(side*6,1.12,z,2.4,.025,.9,'#b7ab8e');
    }
    box(side*2.15,.039,0,.06,.008,18,warm,1);
   }
   box(0,11.7,0,.12,1.4,.12,dark);box(0,12.35,0,1.8,.1,.1,warm,1);

  }else{
   const hab=world.BUILDINGS[0]!,ops=world.BUILDINGS[1]!;
   const crater=new VertexData(),rimPositions:number[]=[],rimIndices:number[]=[],rimColors:number[]=[];
   const rimSegments=profile.segments*2;
   const craterRings=[.12,.62,.91,1.12];
   for(const [i,radius] of craterRings.entries())for(let j=0;j<rimSegments;j++){
    const theta=j/rimSegments*Math.PI*2;
    const r=moonCrater.radius*radius*(1+.05*Math.sin(theta*5)+.035*Math.cos(theta*9));
    rimPositions.push(Math.cos(theta)*r,0,Math.sin(theta)*r);
    const shade=[.22,.255,.48,.367][i]!+Math.cos(theta-.6)*(i===2?.09:.021);
    rimColors.push(shade,shade*.98,shade*.96,1);
    if(i>0){
     const outer=i*rimSegments+j,next=i*rimSegments+(j+1)%rimSegments;
     rimIndices.push(outer-rimSegments,next-rimSegments,outer,outer,next-rimSegments,next);
    }else if(j>0&&j<rimSegments-1)rimIndices.push(0,j+1,j);
   }
   const rimNormals:number[]=[];VertexData.ComputeNormals(rimPositions,rimIndices,rimNormals);
   if(rimNormals[1]!<0){for(let i=0;i<rimIndices.length;i+=3)[rimIndices[i+1],rimIndices[i+2]]=[rimIndices[i+2]!,rimIndices[i+1]!];VertexData.ComputeNormals(rimPositions,rimIndices,rimNormals);}
   crater.positions=rimPositions;crater.indices=rimIndices;crater.normals=rimNormals;crater.colors=rimColors;
   crater.uvs=[];
   for(let i=0;i<rimPositions.length;i+=3)crater.uvs.push((rimPositions[i]!+moonCrater.x)*.19,(rimPositions[i+2]!+moonCrater.z)*.19);
   add(crater,moonCrater.x,-.006,moonCrater.z,'#ffffff',REGOLITH);
   cylinder(0,.013,0,9.2,.014,'#4d5965');
   for(const room of world.BUILDINGS){
    const w=room.width,d=room.depth,main=room.height>4;
    box(room.x,room.height-.055,room.z,w-1.35,.045,d-1.35,'#526878',1);
    if(profile.details>0)for(const section of [-.3,0,.3]){
     box(room.x,room.height-.102,room.z+section*d,w-1.15,.05,.22,'#88a6b7',1);
    }

    const endCladding=VertexData.CreateCylinder({diameterBottom:1,diameterTop:.81,height:.70,tessellation:4});
    add(endCladding,room.x,room.height+.77,room.z,'#b4c3ce',0,Math.PI/4,0,0,new Vector3(w*Math.SQRT2,1,d*Math.SQRT2));
    for(const direction of [-1,1]){
     const x=room.x+direction*(w/2+.28);
     for(const fraction of [-.34,.34]){
      const z=room.z+fraction*d;
      box(x,room.height/2,z,.68,room.height+.1,.55,'#596d7d');
      if(profile.details>0)box(x,.21,z,1.12,.42,1.15,'#364754');
     }
     box(room.x+direction*(w/2-.85),room.height-.05,room.z,.16,.08,d*.72,'#b1daf0',1);
     if(main)box(room.x+direction*(w/2-1.15),3.18,8.4,.13,.07,11.5,'#93c2df',1);
    }
   }
   for(const hatch of moonExteriorAirlocks){
    const h=hatch.yMax!,w=hatch.width;
    for(const side of [-1,1]){
     box(hatch.x+side*(w/2+.13),h/2,hatch.z,.3,h,.67,'#4a6070');
     box(hatch.x+side*(w/2+.14),h*.76,hatch.z,.12,.56,.71,'#61dfcf',1);
    }
    box(hatch.x,h+.12,hatch.z,w+.56,.24,.69,'#516777');
   }
   for(const shelter of moonShelters){
    const direction=shelter.z<0?1:-1;
    const entrance=shelter.z+direction*3.55;
    label(shelter.x,3.22,entrance,7,direction>0?Math.PI:0,0,1.5,.55);
    for(const side of [-1,1])box(shelter.x+side*1.62,1.4,entrance,.16,2.7,.09,'#4ee4c5',1);
    box(shelter.x,1.16,shelter.z-direction*2.6,1.6,.06,.42,'#5cffe0',1);
   }
   for(const rack of moonMaskRacks(rackSeed)){
    const {x,z,side}=rack;
    box(x,1.5,z,.12,.72,1.65,'#243c49');
    box(x-side*.075,1.83,z,.03,.045,1.5,'#59e5cd',1);
    for(const [i,tint] of ['#64dcda','#eebd77','#9ba7ed'].entries()){
     const slot=z+(i-1)*.49;
     box(x-side*.16,1.48,slot,.18,.29,.28,tint);
     if(profile.details>0)box(x-side*.24,1.44,slot,.08,.095,.14,'#344c5a');
    }
   }
   const {z,crossingHalfWidth}=moonCorridor;
   for(const {x,width} of moonCorridorSections){
    box(x,.018,z,width,.025,4.12,'#576574');
    for(const side of [-1,1]){
     box(x,3.09,z+side*1.75,width,.04,.14,'#78c9ed',1);
     box(x,.038,z+side*1.8,width,.012,.11,'#82bdd6',1);
    }
   }
   for(const side of [-1,1])box(side*(crossingHalfWidth-.5),.018,z,.13,.022,7,'#e2b577');
   for(const room of [hab,ops]){
    const trim=room===hab?'#ffd491':'#78c9ed';
    for(const side of [-1,1])box(room.x+side*7.5,room.height-.07,8.45,.19,.05,11.7,trim,1);
    box(room.x,world.SECOND_FLOOR+.02,2.28,16.8,.018,.17,trim,1);
    const side=Math.sign(room.x),stair=world.stairways(room)[0]!;
    const length=stair.end.z-stair.start.z;
    for(let i=0;i<7;i++){
     const step=i*4+2;
     const stairY=stair.end.y*step/32;
     const stairZ=stair.start.z+length*(step-.5)/32;
     box(stair.start.x,stairY+.016,stairZ,2.54,.012,.072,trim,1);
    }
    label(room.x+side*3.9,world.SECOND_FLOOR+1.23,2.1,5,0,0,1.2,.43);
    box(room.x-side*1.4,world.SECOND_FLOOR+1.075,10,2.72,.04,.82,'#2d5372');
    if(profile.details>0)for(const offset of [-.78,0,.78]){
     box(room.x-side*1.4+offset,world.SECOND_FLOOR+1.102,10,.54,.01,.34,'#62d7d7',1);
    }

   }
   for(const x of [-1,1])box(x*2,.024,0,.35,.008,5,'#b3bcc0');box(0,.024,0,4,.008,.35,'#b3bcc0');
   for(const side of [-1,1]){
    box(side*16,.01,0,12,.012,3,'#58636b');
    if(profile.details>0)for(let i=0;i<5;i++)box(side*(13+i*1.8),.024,0,.32,.008,2.5,warm);
    if(profile.details===2)for(let i=0;i<8;i++)box(side*(13+i*1.1),.024,2.2,.6,.008,.28,'#757d83',0,side*.28);
   }
   cylinder(hab.x,hab.height+.9,0,6,.9,dark);dome(hab.x,hab.height+1.35,0,5.7,'#dbe4e2');cylinder(hab.x,hab.height+1.35,0,5.8,.13,accent);
   cylinder(ops.x,ops.height+1.8,0,.5,3,dark);
   const segments=profile.segments*2,rings=4,p:number[]=[],indices:number[]=[],uv:number[]=[];
   for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){const r=j/rings*3.6,a=i/segments*Math.PI*2;p.push(Math.cos(a)*r,r*r*.095,Math.sin(a)*r);uv.push(i/segments,j/rings);}
   for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+1,c=a+segments+1;indices.push(a,b,c,b,c+1,c);}const v=new VertexData(),normals:number[]=[];VertexData.ComputeNormals(p,indices,normals);v.positions=p;v.indices=indices;v.normals=normals;v.uvs=uv;add(v,ops.x,ops.height+3.3,0,'#b9ccd1',0,0,-.38);
   box(ops.x,ops.height+4.6,-.6,.1,2,.1,accent);box(ops.x,ops.height+2.1,7,9,.14,3,'#2e5b75');
   // Rings and solar cells are thin surface details, not additional cover.
   for(let i=0;i<28;i++){const a=i/28*Math.PI*2;box(Math.sin(a)*9.2,.038,Math.cos(a)*9.2,.20,.02,1.18,warm,1,a);}
   label(0,.048,0,6,0,Math.PI/2);
   for(const side of [-1,1])label(side*5,.048,side*15,6,side<0?0:Math.PI,Math.PI/2);
   const detailedSky=quality==='high';
   const earth=VertexData.CreateSphere({diameter:24,segments:detailedSky?56:profile.segments});earth.colors=[];
   const ocean=color('#164779'),landColor=color('#51856b'),cloud=color('#eaf5ff');
   for(let i=0;i<earth.positions!.length;i+=3){
    const x=earth.positions![i]!,y=earth.positions![i+1]!,z=earth.positions![i+2]!;
    const land=Math.sin(x*.42+Math.sin(z*.4)*2)*Math.cos(y*.31);
    let col:Color3;
    if(detailedSky){
     const terrain=land+.26*Math.sin(x*1.4+z*.7)*Math.cos(y*.92);
     col=terrain>.3?Color3.Lerp(landColor,color('#a88e66'),Math.max(0,terrain-.63)):ocean.scale(.86+.22*Math.cos(y*.24));
     const clouds=Math.sin(y*.76+Math.sin(x*.36)*3+z*.25)*Math.cos(x*.9-z*.56)+.25*Math.sin(z*2+y);
     if(Math.abs(y)>10.1)col=Color3.Lerp(col,cloud,Math.min(1,(Math.abs(y)-10.1)*.8));
     if(clouds>.46)col=Color3.Lerp(col,cloud,Math.min(.88,(clouds-.46)*1.6));
     const light=.25+.75*Math.max(0,(x*.49+y*.62-z*.61)/12);
     col=col.scale(light);
    }else col=Math.abs(y)>10?color('#d8e7e7'):land>.28?color('#57918c'):color('#386ba2');
    earth.colors.push(col.r,col.g,col.b,1);
   }
   add(earth,-94,76,135,'#ffffff',2);const eb=batches.get('2:global')!;eb.colors.splice(eb.colors.length-earth.colors.length,earth.colors.length,...earth.colors);
   const stars=quality==='low'?48:quality==='medium'?96:280;
   for(let i=0;i<stars;i++){const a=hash(i,11)*Math.PI*2,e=.12+hash(i,7)*1.25,r=210;const x=Math.cos(a)*Math.cos(e)*r,z=Math.sin(a)*Math.cos(e)*r,y=Math.sin(e)*r;const size=detailedSky?.09+hash(i,9)*.24:.17;box(x,y,z,size,size,size,i%5===0?'#ead5c1':'#b8c7e3',2);}
   if(detailedSky){
    // A dense, tilted stream of faint stars gives the Milky Way its soft edges.
    for(let i=0;i<860;i++){
     const angle=hash(i,31)*Math.PI*2,spread=(hash(i,32)+hash(i,33)+hash(i,34)-1.5)*.16;
     const elevation=.58+.31*Math.sin(angle+.9)+spread;
     const r=216,scale=.13+hash(i,35)*.23;
     const tint=['#627194','#b5b3cd','#7f87ae','#c9b6c7'][i%4]!;
     box(Math.cos(angle)*Math.cos(elevation)*r,Math.sin(elevation)*r,Math.sin(angle)*Math.cos(elevation)*r,scale,scale,scale,tint,2);
    }
    landmarks.push('milky-way');
   }
  }
  if(profile.details>0&&!snow){
   for(const b of world.BUILDINGS){const count=profile.details===2?5:2;for(let i=0;i<count;i++)box(b.x-3+i*1.5,b.height+.9,b.z+b.depth*.28,.8,.65,1.6,dark);}
   // Surface seams and roof equipment are the only additional opaque detail.
   for(const r of world.worldSolids().filter(r=>r.id.includes('wall')&&(r.yMin??0)===0)){const wide=r.width>r.depth,length=wide?r.width:r.depth;for(let i=2;i<length-1;i+=profile.details===2?2.5:5){const offset=i-length/2;box(r.x+(wide?offset:0),2.4,r.z+(wide?0:offset),wide?.035:r.width+.02,3.8,wide?r.depth+.02:.035,dark);}}
  }
  let triangles=0;for(const [key,b] of batches){const mesh=new Mesh(`${map}-batch-${quality}-${key}`,scene),v=new VertexData();v.positions=b.positions;v.normals=b.normals;v.indices=b.indices;v.uvs=b.uvs;v.colors=b.colors;v.applyToMesh(mesh);mesh.material=materials[b.material]!;mesh.parent=root;mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=(b.material===0||b.material===REGOLITH||b.material===BASALT)&&quality!=='low';const indoor=key.includes(':shelter:');mesh.metadata={proceduralMap:map,quality,indoor};mesh.applyFog=(snow||b.material!==2)&&(!indoor||!sheltered);mesh.freezeWorldMatrix();meshes.push(mesh);triangles+=b.indices.length/3;
   if(quality==='high'&&(b.material===0||b.material===BASALT)&&!key.includes('landscape')&&!key.includes('ground'))shadows?.addShadowCaster(mesh,false);
  }
  root.metadata={proceduralMap:map,quality,landmarks};state={source:'procedural',map,quality,triangles,meshCount:meshes.length,textureBytes:grain.byteLength+128*64*3+lunarTextureBytes,collisionCount:world.worldSolids().length,landmarks};
 }
 build('medium');scene.onDisposeObservable.addOnce(release);
 return {setRackSeed(seed:number){if(!snow&&rackSeed!==seed){rackSeed=seed;build(state.quality,true);}},setQuality(value:boolean){high=value;build(high?'high':low?'low':'medium');},setPerformanceLow(value:boolean){low=value;build(high?'high':low?'low':'medium');},syncDoors(){},setSheltered(value:boolean){
  if(value===sheltered)return;
  sheltered=value;
  for(const mesh of meshes)if(mesh.metadata.indoor)mesh.applyFog=!value;
 },state:()=>structuredClone(state)};
}
