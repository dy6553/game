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
const FONT:Record<string,string>={A:'01110100011000111111100011000110001',B:'11110100011000111110100011000111110',C:'01111100001000010000100001000001111',D:'11110100011000110001100011000111110',E:'11111100001000011110100001000011111',H:'10001100011000111111100011000110001',I:'11111001000010000100001000010011111',L:'10000100001000010000100001000011111',N:'10001110011010110011100011000110001',O:'01110100011000110001100011000101110',P:'11110100011000111110100001000010000',R:'11110100011000111110101001001010001',S:'01111100001000001110000010000111110',T:'11111001000010000100001000010000100',U:'10001100011000110001100011000101110','0':'01110100011001110101110011000101110','1':'00100011000010000100001000010001110','2':'01110100010000100010001000100011111','-':'00000000000000011111000000000000000'};
function signTexture(scene:Scene){const w=128,h=64,p=new Uint8Array(w*h*3),labels=['OBS 01','A1 LAB','A2 LAB','HAB 01','OPS 02','AIRLOCK','PAD 01','CAUTION'];labels.forEach((text,index)=>{const ox=index%2*64,oy=Math.floor(index/2)*16;for(let y=0;y<16;y++)for(let x=0;x<64;x++){const i=((h-1-oy-y)*w+ox+x)*3;p[i]=12;p[i+1]=36;p[i+2]=45;}for(let k=0;k<text.length;k++){const glyph=FONT[text[k]!]??'0'.repeat(35);for(let y=0;y<7;y++)for(let x=0;x<5;x++)if(glyph[y*5+x]==='1'){const i=((h-1-oy-4-y)*w+ox+4+k*6+x)*3;p[i]=210;p[i+1]=238;p[i+2]=226;}}});const t=RawTexture.CreateRGBTexture(p,w,h,scene,false,false,Texture.NEAREST_SAMPLINGMODE);t.name='procedural-map-signs';return t;}


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

export function createProceduralExpansion(scene:Scene,map:ExpansionMapId,world:World,shadows?:ShadowGenerator){
 let high=false,low=false,sheltered=false,root:TransformNode|undefined,owned:StandardMaterial[]=[],textures:RawTexture[]=[],meshes:Mesh[]=[],state:ProceduralMapState;
 const snow=map==='snow',bounds=world.PROTOTYPE;
 function release(){for(const m of meshes)shadows?.removeShadowCaster(m,false);root?.dispose();meshes=[];for(const m of owned)m.dispose();for(const t of textures)t.dispose();owned=[];textures=[];root=undefined;}
 function build(quality:ExpansionQuality){
  if(scene.isDisposed||state?.quality===quality)return;release();const profile=EXPANSION_PROFILES[quality],batches=new Map<string,Batch>();
  root=new TransformNode(`${map}-procedural-${quality}`,scene);
  const surface=new StandardMaterial('procedural-map-surface',scene);surface.diffuseColor=Color3.White();surface.specularColor=new Color3(.035,.035,.035);surface.ambientColor=new Color3(.22,.22,.22);surface.emissiveColor=new Color3(.07,.075,.08);surface.maxSimultaneousLights=2;
  const grain=new Uint8Array(profile.texture*profile.texture*3);for(let i=0;i<grain.length;i+=3){const v=246+Math.floor(hash((i/3)%profile.texture,Math.floor(i/3/profile.texture))*9);grain[i]=grain[i+1]=grain[i+2]=v;}
  const texture=RawTexture.CreateRGBTexture(grain,profile.texture,profile.texture,scene,true,false,Texture.BILINEAR_SAMPLINGMODE);texture.name='procedural-map-grain';texture.anisotropicFilteringLevel=quality==='low'?1:quality==='medium'?2:4;surface.diffuseTexture=texture;
  const glow=new StandardMaterial('procedural-map-inlay',scene);glow.diffuseColor=Color3.White();glow.emissiveColor=new Color3(.55,.55,.55);glow.specularColor=Color3.Black();glow.maxSimultaneousLights=1;
  const sky=new StandardMaterial('procedural-map-sky',scene);sky.disableLighting=true;sky.emissiveColor=Color3.White();sky.diffuseColor=Color3.White();sky.specularColor=Color3.Black();sky.backFaceCulling=false;
  const signs=new StandardMaterial('procedural-map-sign',scene);const atlas=signTexture(scene);signs.diffuseTexture=atlas;signs.emissiveTexture=atlas;signs.emissiveColor=new Color3(.3,.3,.3);signs.specularColor=Color3.Black();
  owned=[surface,glow,sky,signs];textures=[texture,atlas];
  const materials=owned;
  function add(v:VertexData,x:number,y:number,z:number,tint:string,material=0,yaw=0,pitch=0,roll=0,scale:Vector3=new Vector3(1,1,1),special?:string){
   const key=special??(material===0?`${Math.max(0,Math.min(Math.ceil(bounds.halfWidth*2/40)-1,Math.floor((x+bounds.halfWidth)/40)))},${Math.max(0,Math.min(Math.ceil((bounds.maxZ+bounds.halfDepth)/40)-1,Math.floor((z+bounds.halfDepth)/40)))}`:'global');
   const indoors=snow&&(special==='shelter'||(!special&&world.indoorAt({x,y,z})));
   const id=material+':'+(indoors?'shelter:':'')+key;let b=batches.get(id);if(!b){b={positions:[],normals:[],indices:[],uvs:[],colors:[],material};batches.set(id,b);}const offset=b.positions.length/3,c=color(tint),matrix=Matrix.Compose(scale,Quaternion.RotationYawPitchRoll(yaw,pitch,roll),new Vector3(x,y,z));
   const p=v.positions!,n=v.normals!,out=new Vector3(),norm=new Vector3();for(let i=0;i<p.length;i+=3){Vector3.TransformCoordinatesFromFloatsToRef(p[i]!,p[i+1]!,p[i+2]!,matrix,out);Vector3.TransformNormalFromFloatsToRef(n[i]!,n[i+1]!,n[i+2]!,matrix,norm);norm.normalize();b.positions.push(out.x,out.y,out.z);b.normals.push(norm.x,norm.y,norm.z);b.colors.push(c.r,c.g,c.b,1);b.uvs.push(v.uvs?.[i/3*2]??0,v.uvs?.[i/3*2+1]??0);}for(const i of v.indices!)b.indices.push(i+offset);
  }
  function box(x:number,y:number,z:number,w:number,h:number,d:number,c:string,mat=0,yaw=0){add(VertexData.CreateBox({width:w,height:h,depth:d}),x,y,z,c,mat,yaw);}
  function cylinder(x:number,y:number,z:number,r:number,h:number,c:string,mat=0){add(VertexData.CreateCylinder({diameter:r*2,height:h,tessellation:profile.segments}),x,y,z,c,mat);}
  function dome(x:number,y:number,z:number,r:number,c:string){add(VertexData.CreateSphere({diameter:r*2,segments:profile.segments,slice:.5}),x,y,z,c);}
  function label(x:number,y:number,z:number,index:number,yaw=0,pitch=0,width=3.2,height=.8){const v=VertexData.CreatePlane({width,height,sideOrientation:Mesh.DOUBLESIDE});const u=index%2*.5,t=Math.floor(index/2)*.25;v.uvs=v.uvs!.map((a,i)=>i%2?1-t-.25+a*.25:u+a*.5);add(v,x,y,z,'#ffffff',3,yaw,pitch);}
  const white=snow?'#d6e7ea':'#c6cfd2',dark=snow?'#284958':'#35404e',accent=snow?'#278c99':'#b79a55',warm='#e9a35d';
  // Exact shared rectangles are the visual foundation at all three levels.
  for(const r of world.worldSolids()){
   if(snow&&(snowShellIds.has(r.id)||r.id==='igloo-central-pillar'))continue;
   const min=r.yMin??0,max=r.yMax??r.height??2,wall=/wall|lintel/.test(r.id),roof=r.id.endsWith(' roof'),isDark=!snow&&r.id.startsWith('Operations');
   const tint=wall?(isDark?dark:white):roof?(snow?'#edf3f1':dark):/basalt/.test(r.id)?'#555a63':/console|igloo-workbench/.test(r.id)?dark:/support/.test(r.id)?dark:accent;
   box(r.x,(min+max)/2,r.z,r.width,max-min,r.depth,tint);
   if(wall&&min===0){
    // Inlays stay on solid walls; never bridge a walkable opening.
    const wide=r.width>r.depth,length=wide?r.width:r.depth;
    for(const side of [-1,1]){const x=r.x+(wide?0:side*(r.width/2+.006)),z=r.z+(wide?side*(r.depth/2+.006):0);
     box(x,.42,z,wide?length:.015,.32,wide?.015:length,dark);
     box(x,Math.min(3.6,max-.3),z,wide?length:.018,.23,wide?.018:length,accent);
     if(length>4){const count=Math.floor((length-1)/5);for(let i=0;i<count;i++){const offset=(i-(count-1)/2)*5;box(x+(wide?offset:0),2.1,z+(wide?0:offset),wide?3:.022,.7,wide?.022:3,'#345668');if(profile.details>0)box(x+(wide?offset:0),2.5,z+(wide?0:offset),wide?3.15:.032,.07,wide?.032:3.15,white);}}
    }
   }
   if(/lintel/.test(r.id)){const wide=r.width>r.depth;box(r.x,min+.1,r.z,wide?r.width:.54,.12,wide?.54:r.depth,warm,1);}
   if(!wall&&!roof&&!/support|basalt/.test(r.id)){
    box(r.x,max+.012,r.z,r.width*.8,.024,r.depth*.75,dark);box(r.x,max*.65,r.z-r.depth/2-.012,r.width*.65,.18,.025,warm,1);
    if(profile.details>0){for(const side of [-1,1])box(r.x+side*r.width*.38,(min+max)/2,r.z,.065,(max-min)*.9,r.depth*1.01,white);}
   }
  }
  // Flat paths and room floors add no obstacles or different sightlines.
  for(const [i,b] of world.BUILDINGS.entries()){
   if(snow)continue;
   box(b.x,.018,b.z,b.width-.5,.03,b.depth-.5,snow?'#708990':'#66717b');
   for(const side of [-1,1]){
    box(b.x, b.height+.48,b.z+side*(b.depth/2-.25),b.width,.06,.25,white);
    label(b.x+(b.width/2+3)/2,3.45,b.z+side*(b.depth/2+.28),snow?(i===0?0:i):i===0?3:4,side===-1?0:Math.PI,0,Math.min(3.2,(b.width-6)/2-.2));
    box(b.x,.025,b.z+side*(b.depth/2+2),2.8,.025,3.6,dark);
    for(const x of [-1,1])box(b.x+x*1.3,.046,b.z+side*(b.depth/2+2),.11,.018,3.6,warm,1);
   }
   if(profile.details>0){const count=profile.details===2?8:4;for(let j=0;j<count;j++){
    const x=b.x-b.width*.4+b.width*.8*j/(count-1);box(x,b.height+.5,b.z,.08,.05,b.depth*.92,dark);
   }}
  }
  function grid(terrain:boolean){const n=terrain?profile.terrain:profile.ground,w=bounds.halfWidth*2,d=bounds.maxZ+bounds.halfDepth,p:number[]=[],c:number[]=[],uv:number[]=[],indices:number[]=[];
   const margin=terrain?110:20;
   for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
    const x=(i/n-.5)*(w+margin*2),z=(j/n-.5)*(d+margin*2),outside=Math.max(Math.abs(x)-w/2,Math.abs(z)-d/2),e=Math.max(0,outside-3);
    let y=terrain?(snow?Math.min(1,e/20)*(7+Math.pow(hash(Math.floor(x/18),Math.floor(z/18)),2)*34)+Math.sin(x*.045)*Math.cos(z*.04)*Math.min(e*.15,6):Math.min(1,e/15)*(2+hash(Math.floor(x/12),Math.floor(z/12))*8)):-.012;
    if(!terrain)y=-.012;let col=snow?new Color3(.72,.82,.87):new Color3(.31,.33,.38);
    if(terrain){const v=hash(Math.floor(x/10),Math.floor(z/10));col=snow?(y>22?new Color3(.83,.88,.89):new Color3(.30+v*.12,.41+v*.12,.49+v*.12)):new Color3(.21+v*.09,.23+v*.09,.27+v*.09);}
    else if(!snow){for(const [cx,cz,r] of [[-12,25,8],[13,-26,7],[0,0,14]]){const q=Math.hypot(x-cx!,z-cz!)/r!;if(q<1.3&&q>.75)col=col.scale(1.22);else if(q<.75)col=col.scale(.82);}col=col.scale(.95+hash(i,j)*.1);}
    else col=col.scale(.97+hash(i,j)*.05);
    p.push(x,y,z);c.push(col.r,col.g,col.b,1);uv.push(x*.08,z*.08);
   }
   for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=((i+.5)/n-.5)*(w+margin*2),z=((j+.5)/n-.5)*(d+margin*2);const dx=(w+margin*2)/n/2,dz=(d+margin*2)/n/2;if(terrain&&Math.abs(x)-dx<w/2+3&&Math.abs(z)-dz<d/2+3)continue;const a=j*(n+1)+i,b=a+1,k=a+n+1;indices.push(a,b,k,b,k+1,k);}
   const normals:number[]=[];VertexData.ComputeNormals(p,indices,normals);const v=new VertexData();v.positions=p;v.normals=normals;v.indices=indices;v.uvs=uv;
   // Preserve authored elevation colors in the shared surface batch.
   add(v,0,0,0,'#ffffff',0,0,0,0,new Vector3(1,1,1),terrain?'landscape':'ground');const batch=batches.get('0:'+(terrain?'landscape':'ground'))!;batch.colors.splice(batch.colors.length-c.length,c.length,...c);
  }
  grid(false);grid(true);
  const landmarks=snow?['observatory','mountain-ridge','igloo-hub','arched-laboratories','heated-links']:['habitat-dome','communications-dish','landing-pad','earth'];
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
   cylinder(0,.008,0,12,.014,'#4d5965');
   for(const x of [-1,1])box(x*2,.024,0,.35,.008,5,'#b3bcc0');box(0,.024,0,4,.008,.35,'#b3bcc0');
   for(const side of [-1,1]){
    box(side*17,.01,0,10,.012,3,'#58636b');
    if(profile.details>0)for(let i=0;i<5;i++)box(side*(13+i*1.8),.024,0,.32,.008,2.5,warm);
    if(profile.details===2)for(let i=0;i<8;i++)box(side*(13+i*1.1),.024,2.2,.6,.008,.28,'#757d83',0,side*.28);
   }
   cylinder(hab.x,6.9,0,6,.9,dark);dome(hab.x,7.35,0,5.7,'#dbe4e2');cylinder(hab.x,7.35,0,5.8,.13,accent);
   cylinder(ops.x,7.8,0,.5,3,dark);
   const segments=profile.segments*2,rings=4,p:number[]=[],indices:number[]=[],uv:number[]=[];
   for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){const r=j/rings*3.6,a=i/segments*Math.PI*2;p.push(Math.cos(a)*r,r*r*.095,Math.sin(a)*r);uv.push(i/segments,j/rings);}
   for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+1,c=a+segments+1;indices.push(a,b,c,b,c+1,c);}const v=new VertexData(),normals:number[]=[];VertexData.ComputeNormals(p,indices,normals);v.positions=p;v.indices=indices;v.normals=normals;v.uvs=uv;add(v,ops.x,9.3,0,'#b9ccd1',0,0,-.38);
   box(ops.x,10.6,-.6,.1,2,.1,accent);box(ops.x,8.1,7,9,.14,3,'#2e5b75');
   // Rings and solar cells are thin surface details, not additional cover.
   for(let i=0;i<32;i++){const a=i/32*Math.PI*2;box(Math.sin(a)*12,.034,Math.cos(a)*12,.22,.025,1.45,warm,1,a);}
   label(0,.048,0,6,0,Math.PI/2);
   for(const side of [-1,1])label(side*5,.048,side*15,6,side<0?0:Math.PI,Math.PI/2);
   const earth=VertexData.CreateSphere({diameter:24,segments:profile.segments});earth.colors=[];
   for(let i=0;i<earth.positions!.length;i+=3){const x=earth.positions![i]!,y=earth.positions![i+1]!,z=earth.positions![i+2]!,land=Math.sin(x*.42+Math.sin(z*.4)*2)*Math.cos(y*.31)> .28,col=Math.abs(y)>10?color('#d8e7e7'):land?color('#57918c'):color('#386ba2');earth.colors.push(col.r,col.g,col.b,1);}
   add(earth,-94,76,135,'#ffffff',2);const eb=batches.get('2:global')!;eb.colors.splice(eb.colors.length-earth.colors.length,earth.colors.length,...earth.colors);
   const stars=quality==='low'?48:quality==='medium'?96:144;for(let i=0;i<stars;i++){const a=hash(i,11)*Math.PI*2,e=.12+hash(i,7)*1.25,r=210;const x=Math.cos(a)*Math.cos(e)*r,z=Math.sin(a)*Math.cos(e)*r,y=Math.sin(e)*r;box(x,y,z,.17,.17,.17,'#b8c7d3',2);}
  }
  if(profile.details>0&&!snow){
   for(const b of world.BUILDINGS){const count=profile.details===2?5:2;for(let i=0;i<count;i++)box(b.x-3+i*1.5,b.height+.9,b.z+b.depth*.28,.8,.65,1.6,dark);}
   // Surface seams and roof equipment are the only additional opaque detail.
   for(const r of world.worldSolids().filter(r=>r.id.includes('wall')&&(r.yMin??0)===0)){const wide=r.width>r.depth,length=wide?r.width:r.depth;for(let i=2;i<length-1;i+=profile.details===2?2.5:5){const offset=i-length/2;box(r.x+(wide?offset:0),2.4,r.z+(wide?0:offset),wide?.035:r.width+.02,3.8,wide?r.depth+.02:.035,dark);}}
  }
  let triangles=0;for(const [key,b] of batches){const mesh=new Mesh(`${map}-batch-${quality}-${key}`,scene),v=new VertexData();v.positions=b.positions;v.normals=b.normals;v.indices=b.indices;v.uvs=b.uvs;v.colors=b.colors;v.applyToMesh(mesh);mesh.material=materials[b.material]!;mesh.parent=root;mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=b.material===0&&quality!=='low';const indoor=key.includes(':shelter:');mesh.metadata={proceduralMap:map,quality,indoor};mesh.applyFog=!indoor||!sheltered;mesh.freezeWorldMatrix();meshes.push(mesh);triangles+=b.indices.length/3;
   if(quality==='high'&&b.material===0&&!key.includes('landscape')&&!key.includes('ground'))shadows?.addShadowCaster(mesh,false);
  }
  root.metadata={proceduralMap:map,quality,landmarks};state={source:'procedural',map,quality,triangles,meshCount:meshes.length,textureBytes:grain.byteLength+128*64*3,collisionCount:world.worldSolids().length,landmarks};
 }
 build('medium');scene.onDisposeObservable.addOnce(release);
 return {setQuality(value:boolean){high=value;build(high?'high':low?'low':'medium');},setPerformanceLow(value:boolean){low=value;build(high?'high':low?'low':'medium');},syncDoors(){},setSheltered(value:boolean){
  if(value===sheltered)return;
  sheltered=value;
  for(const mesh of meshes)if(mesh.metadata.indoor)mesh.applyFog=!value;
 },state:()=>structuredClone(state)};
}
