import {stanceStats,type Stance} from './stance.ts';
import {createRemoteModels,type RemoteModel} from './remote-models.ts';
import {createHarborMapArt,type HarborArtSource} from './harbor-map-art.ts';
import {unobstructed,firstShotBox} from './combat-geometry.ts';
import {playerName} from './nickname.ts';
import type {Sound} from './audio.ts';
import {createMatchPickups} from './match-pickups.ts';
import {createGear,launchRocket,useEquipment,advanceEquipment,type GearActor,type EquipmentId,type Projectile} from './equipment.ts';
import {createEquipmentVisuals} from './equipment-visuals.ts';
import {createLobbyWeapons} from './lobby-weapons.ts';
import {createSupplyCrates} from './supply-crates.ts';
import {createInventory,createPickups,takeEquipmentPickup,syncSlot,advanceStowed,switchSlot,takePickup,tickPickups} from './inventory.ts';
import type { MatchState } from './network-game.ts';
import { createRecoil,type ShakeLevel } from './impact.ts';
import { createRobotImpact } from './robot-impact.ts';
import { WEAPONS,upgradedWeapon,pelletOffsets,startBurst,advanceBurst,cancelBurst,cadenceCarry,type WeaponId } from './weapons.ts';
import { createBotRules,isSurvivalDifficulty,type SurvivalDifficulty } from './duel.ts';
import type { Engine } from '@babylonjs/core/Engines/engine.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3, Vector4,Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { PointLight } from '@babylonjs/core/Lights/pointLight.js';
import { createShotEffects } from './shot-effects.ts';
import { addStreetDetails } from './street-details.ts';
import { createNightGround } from './night-lighting.ts';
import { createAtmosphere } from './atmosphere.ts';
import { createSurface,createSurfaceNormals } from './surfaces.ts';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { Look } from './view.ts';
import { Ray } from '@babylonjs/core/Culling/ray.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { PRACTICE_RULES,createWeapon,tryFire,beginReload,advanceWeapon,applyDamage } from './combat.ts';
import { createJump,beginJump,advanceJump,type JumpState } from './jump.ts';
import {harborWorld,createWorld,type MapId,type Doors} from './world.ts';
import type { Point } from './world.ts';
import { createCharacter } from './characters.ts';
import type { CharacterType } from './characters.ts';

export function createHarborScene(engine: Engine,options:{randomSpawns?:boolean;map?:MapId;mapArtSource?:HarborArtSource}={}) {
  const geometry=options.map==='factory'?createWorld('factory'):harborWorld;
  const {PROTOTYPE,BUILDINGS,COVERS,buildingWalls,interiorFurniture,indoorAt,DOOR_WIDTH,createDoors,worldSolids,moveWithCollisions,doorRect,toggleDoor,randomOutdoorSpawn,shotBoxes}=geometry;
  const {createDuel,createBotMatch,createSurvivalMatch}=createBotRules(geometry);
  const scene = new Scene(engine);
  scene.skipPointerMovePicking=true;scene.skipPointerDownPicking=true;scene.skipPointerUpPicking=true;
  scene.clearColor = new Color4(0.035, 0.065, 0.115, 1);
  scene.imageProcessingConfiguration.toneMappingEnabled=true;
  scene.imageProcessingConfiguration.toneMappingType=1;
  scene.imageProcessingConfiguration.exposure=1.22;
  scene.imageProcessingConfiguration.contrast=1.02;
  scene.ambientColor = new Color3(0.2, 0.19, 0.22);
  scene.fogMode=Scene.FOGMODE_EXP2;scene.fogDensity=0.004;scene.fogColor=new Color3(0.07,0.095,0.155);
  const camera = new FreeCamera('camera', new Vector3(36, 55, -36), scene);
  camera.mode = FreeCamera.PERSPECTIVE_CAMERA;camera.updateUpVectorFromRotation=true;
  camera.fov = 1.25;
  camera.minZ = 0.06; camera.maxZ = 500;
  const sky = new HemisphericLight('sky', new Vector3(0, 1, 0), scene);
  sky.intensity = 0.65; sky.diffuse = Color3.FromHexString('#b4b9cb');
  sky.groundColor = Color3.FromHexString('#647187');
  const moon = new DirectionalLight('moon', new Vector3(-0.45, -1, 0.25), scene);
  moon.position = new Vector3(25, 55, -35); moon.intensity = 0.32;
  moon.diffuse = Color3.FromHexString('#bdcce7');
  const shadows = new ShadowGenerator(engine.getRenderWidth() > 1100 ? 2048 : 1024, moon);
  shadows.usePoissonSampling = true; shadows.bias = 0.003;
  shadows.darkness = 0.35;
  moon.shadowFrustumSize=64;moon.autoUpdateExtends=false;moon.shadowMinZ=1;moon.shadowMaxZ=120;
  const material = (name: string, color: string, emission?: string) => {
    const mat = new StandardMaterial(name, scene);
    mat.diffuseColor = Color3.FromHexString(color);
    mat.specularColor = new Color3(0.035, 0.03, 0.035);
    mat.maxSimultaneousLights=6;
    if (emission) mat.emissiveColor = Color3.FromHexString(emission);
    return mat;
  };
  const stone = material('paving', '#ad9c8a');
  const asphalt = material('asphalt', '#51515d');
  const line = material('road-markings', '#b6b4a4');
  const metal = material('metal', '#28384c');
  const wood = material('wood', '#83634d');
  const warm = material('warm-light', '#c6a070', '#826039');
  const glass = material('glass', '#486b83', '#1b354a');
  const foliage = material('foliage', '#35574d');
  const petals = material('petals', '#b6a0c2');
  const litWindow = [material('window-gold','#bb9165','#8e6237'),material('window-soft','#b19b7e','#60452e'),material('window-dark','#3d3d47','#0a0b10')];
  const windowTexture=createSurface(scene,'window');warm.diffuseTexture=windowTexture;
  litWindow[0]!.diffuseTexture=windowTexture;litWindow[1]!.diffuseTexture=windowTexture;
  const awningMats=[material('awning-linen','#b9a78f'),material('awning-burgundy','#845d5a'),material('awning-blue','#68798d')];
  const canopyMat=material('tree-canopy','#4b634b');
  const roofMat = material('roof', '#30465b');
  const bodyMaterials = ['#c4b19e', '#b8a18e', '#aa9f94'].map((color, i) => material(`facade-${i}`, color));
  stone.diffuseTexture = createSurface(scene, 'paving');
  asphalt.diffuseTexture = createSurface(scene, 'road');
  roofMat.diffuseTexture = createSurface(scene, 'roof');
  const plaster = createSurface(scene, 'plaster');
  for (const mat of bodyMaterials) mat.diffuseTexture = plaster;
  const wallNormal=createSurfaceNormals(scene,'wall');
  for(const mat of bodyMaterials){mat.bumpTexture=wallNormal;mat.specularPower=24;}
  roofMat.bumpTexture=createSurfaceNormals(scene,'stone');
  metal.specularColor=Color3.FromHexString('#708494');metal.specularPower=100;
  glass.specularColor=Color3.FromHexString('#abc5db');glass.specularPower=128;
  const streetLights: PointLight[] = [];
  for (const [x,z] of [[-9,-9],[9,9],[-10,22],[10,-22]]) {
    const lamp = new PointLight('warm-streetlight', new Vector3(x!,4,z!), scene);
    lamp.diffuse = Color3.FromHexString('#ffd4a0'); lamp.intensity=2.2;lamp.range=24;streetLights.push(lamp);
  }
  const box = (name: string, x: number, y: number, z: number,
    width: number, height: number, depth: number, mat: StandardMaterial) => {
    const mesh = MeshBuilder.CreateBox(name, { width, height, depth, faceUV: [
      new Vector4(0,0,width/2,height/2),new Vector4(0,0,width/2,height/2),
      new Vector4(0,0,depth/2,height/2),new Vector4(0,0,depth/2,height/2),
      new Vector4(0,0,width/2,depth/2),new Vector4(0,0,width/2,depth/2)] }, scene);
    mesh.position.set(x, y, z); mesh.material = mat;
    if(mat===warm || mat.name.startsWith('window-')) {
      const uv=mesh.getVerticesData('uv')!;const face=[0,0,1,0,1,1,0,1];
      for(let i=0;i<uv.length;i++)uv[i]=face[i%8]!;mesh.setVerticesData('uv',uv);
    }
    mesh.isPickable = false;
    return mesh;
  };
  createNightGround(scene,stone,'ground',0,-13,132,100,0);
  createNightGround(scene,asphalt,'main-road',0,0,128,10,0.012);
  createNightGround(scene,asphalt,'cross-road',0,-13,10,94,0.016);
  for(const x of [-61,-25,25,61])createNightGround(scene,asphalt,'side-alley',x,-13,4.8,94,0.02);
  createNightGround(scene,stone,'plaza',0,0,21,23,0.04);
  for(let x=-42;x<44;x+=6)if(Math.abs(x)>12)box('road-dash',x,0.04,0,2.6,0.012,0.15,line);
  for(const x of [-12,12])for(let z=-3;z<=3;z+=1)box('crosswalk',x,0.04,z,2,0.02,0.5,line);

  createNightGround(scene,asphalt,'southern-boulevard',0,-32,128,8,.018);
  if(options.map==='factory'){
    for(const m of bodyMaterials){m.diffuseColor=Color3.FromHexString('#53636a');}
    roofMat.diffuseColor=Color3.FromHexString('#35474b');interiorFactory();
  }
  function interiorFactory(){
    const rust=material('factory-rust','#995a32'),steel=material('factory-steel','#3b515b'),warning=material('factory-warning','#e0ac39','#3a2309');
    for(const b of BUILDINGS){
      for(const side of [-1,1])box('factory-roof-ridge',b.x+side*(b.width/2-1),b.height+.3,b.z,.3,.6,b.depth,steel);
      if(!b.enterable){
        const stack=MeshBuilder.CreateCylinder('factory-smokestack',{diameter:2,height:7,tessellation:12},scene);stack.position.set(b.x,b.height+3.5,b.z);stack.material=rust;stack.isPickable=false;
      }
      box('factory-hazard-strip',b.x,.025,b.z+(b.z<0?1:-1)*(b.depth/2+.8),b.width,.03,.35,warning);
    }
  }
  const interiorLights:{id:string;light:PointLight}[]=[];
  const interiorFloor=material('interior-floor','#9f6b48');interiorFloor.diffuseTexture=createSurface(scene,'wood');
  const occluders: { meshes: Mesh[]; min: Vector3; max: Vector3 }[] = [];
  const batch = (meshes: Mesh[]) => {
    const groups = new Map<StandardMaterial, Mesh[]>();
    for (const mesh of meshes) {
      const mat = mesh.material as StandardMaterial;
      const group = groups.get(mat) ?? [];
      group.push(mesh); groups.set(mat, group);
    }
    const merged: Mesh[] = [];
    for (const [mat, group] of groups) {
      if (group.length === 1) { merged.push(group[0]!); continue; }
      const mesh = Mesh.MergeMeshes(group, true, true);
      if (!mesh) throw new Error('맵 메시를 준비하지 못했습니다.');
      mesh.name = `batch-${mat.name}`; mesh.material = mat;
      mesh.isPickable = false; mesh.receiveShadows = true;
      merged.push(mesh);
    }
    return merged;
  };
  let doors:Doors=createDoors();
  const doorMeshes=new Map<string,Mesh>();
  const entryMat=material('enterable-entry','#0c8e67','#23c992');
  const entrySignMat=material('entry-sign-material','#ffffff','#ffffff');
  if(typeof document!=='undefined'&&typeof document.createElement('canvas').getContext==='function'){
    const texture=new DynamicTexture('entry-sign-text',{width:512,height:128},scene,false);
    texture.drawText('출입 가능 · 2F / 옥상',null,78,'bold 36px sans-serif','#dcfff4','#084a3a',true,true);entrySignMat.diffuseTexture=texture;entrySignMat.emissiveTexture=texture;
  }else entrySignMat.diffuseColor=Color3.FromHexString('#23c992');
  function syncDoors(){for(const b of BUILDINGS.filter(b=>b.enterable)){const mesh=doorMeshes.get(b.id)!;mesh.rotation.y=doors[b.id]?(b.z<0?1:-1)*Math.PI/2:0;mesh.isPickable=!doors[b.id];}mapArt?.syncDoors();}
  for (const building of BUILDINGS) {
    const { id, x, z, width, depth, height, palette } = building;
    const meshes: Mesh[] = [];
    const part = (name: string, px: number, py: number, pz: number, w: number, h: number, d: number, mat: StandardMaterial) => {
      const mesh = box(`${id}-${name}`, px, py, pz, w, h, d, mat);
      meshes.push(mesh); return mesh;
    };
    const body = part('body', x, building.enterable?3.3:height/2, building.enterable?doorRect(building).z:z, building.enterable?DOOR_WIDTH:width,building.enterable?.2:height,building.enterable?.4:depth,bodyMaterials[palette]!);
    if(building.enterable){
      for(const wall of buildingWalls(building))part('shell-'+wall.id,wall.x,height/2,wall.z,wall.width,height,wall.depth,bodyMaterials[palette]!);
      part('interior-floor',x,.035,z,width-.45,.06,depth-.45,interiorFloor);
      for(const slab of shotBoxes({}).filter(r=>r.id.startsWith(id+'-floor')||r.id===id+'-balcony'||r.id===id+'-stair-step'))part(slab.id,slab.x,((slab.yMin??0)+(slab.yMax??0))/2,slab.z,slab.width,(slab.yMax??0)-(slab.yMin??0),slab.depth,slab.id.includes('stair')?wood:interiorFloor);
      for(const fence of worldSolids().filter(rect=>rect.id.startsWith(id+'-roof-rail-')||rect.id.startsWith(id+'-balcony-rail-'))){
        const base=fence.yMin!,top=fence.yMax!;
        part(fence.id,fence.x,(base+top)/2,fence.z,fence.width,top-base,fence.depth,metal);
      }
      const rect=doorRect(building),door=box(id+'-interactive-door',rect.x,1.6,rect.z,rect.width,3.2,rect.depth,wood);door.setPivotPoint(new Vector3(-rect.width/2,0,0));doorMeshes.set(id,door);shadows.addShadowCaster(door);
      part('entry-green-header',x,3.3,rect.z+(z<0?.3:-.3),DOOR_WIDTH+.4,.15,.12,entryMat);
      for(const side of [-1,1])part('entry-green-side',x+side*(DOOR_WIDTH/2+.18),1.6,rect.z+(z<0?.3:-.3),.13,3.2,.12,entryMat);
      const sign=MeshBuilder.CreatePlane(id+'-entry-sign',{width:4,height:1,sideOrientation:Mesh.DOUBLESIDE},scene);sign.position.set(x,3.95,rect.z+(z<0?.28:-.28));sign.rotation.y=z<0?Math.PI:0;sign.material=entrySignMat;sign.isPickable=false;
      for(let i=0;i<3;i++)part('entry-path-marker',x,.07,rect.z+(z<0?1:-1)*(1+i*.7),.7,.025,.3,entryMat);

      part('ceiling-light',x,3.25,z,2.5,.08,.7,warm);
      part('open-entry-light',x,3.02,z+(z<0?1:-1)*(depth/2+.22),.85,.09,.09,glass);
      part('door-lintel',x,3.2,z+(z<0?1:-1)*depth/2,DOOR_WIDTH,.3,.5,wood);
      for(const side of [-1,1])part('door-jamb',x+side*(DOOR_WIDTH/2+.06),1.6,z+(z<0?1:-1)*depth/2,.12,3.2,.6,wood);
      for(const item of interiorFurniture(building)){
        const counter=item.id.endsWith('counter');
        part('furniture-'+item.id,item.x,counter?.65:.45,item.z,item.width,counter?1.3:.9,item.depth,wood);
        part('furniture-top',item.x,counter?1.32:.92,item.z,item.width+.12,.07,item.depth+.12,stone);
        if(counter)for(let i=0;i<5;i++){part('counter-cup',item.x,1.5,item.z-1.6+i*.7,.18,.28,.18,litWindow[i%2]!);}
      }
      const lamp=new PointLight(building.id+'-interior-light',new Vector3(x,2.7,z),scene);lamp.diffuse=Color3.FromHexString('#ffd0a0');lamp.intensity=1.4;lamp.range=15;lamp.setEnabled(false);interiorLights.push({id:building.id,light:lamp});

    }
    body.receiveShadows = true; shadows.addShadowCaster(body);
    if(!building.enterable)part('foundation', x, 0.3, z, width + 0.3, 0.6, depth + 0.3, metal);
    if(!building.enterable)part('cornice', x, height - 0.1, z, width + 0.5, 0.25, depth + 0.5, stone);
    for (const side of (building.enterable?[]:[-1,1])) {
      const roof = part('roof', x, height+0.65, z+side*depth/4, width+0.85,0.22,depth/2+0.8,roofMat);
      roof.rotation.x=side*0.18;shadows.addShadowCaster(roof);
      part('gutter',x,height+0.1,z+side*(depth/2+0.5),width+1,0.15,0.14,metal);
    }
    if(!building.enterable)part('roof-ridge',x,height+1.28,z,width+1,0.18,0.28,metal);
    const front = z < 0 ? 1 : -1;
    const frontZ = z + front * (depth / 2 + 0.06);
    for (let floor = 2; floor < height - 0.8; floor += 2.4) {
      for (let offset = -width / 2 + 1.3; offset < width / 2 - 0.5; offset += 2.5) {
        if(building.enterable&&Math.abs(offset)<2.4)continue;
        part('window-frame', x + offset, floor, frontZ, 1.55, 1.5, 0.14, metal);
        part('window', x + offset, floor, frontZ + front * 0.08, 1.3, 1.24, 0.06, litWindow[(Math.floor(offset+width)+Math.floor(floor)+palette)%3]!);
        part('mullion', x + offset, floor, frontZ + front * 0.13, 0.06, 1.3, 0.08, wood);
      }
    }
    if(!building.enterable)part('door', x, 1.15, frontZ + front * 0.1, 1.5, 2.3, 0.2, wood);
    if(!building.enterable)part('door-glass', x, 1.5, frontZ + front * 0.22, 1.05, 1.05, 0.04, litWindow[1]!);
    part('awning', x, 2.85, frontZ + front * 0.5, width * 0.85, 0.25, 1.35, awningMats[palette]!);
    for (let stripe = -width * 0.37; stripe < width * 0.4; stripe += 0.85) {
      part('awning-stripe', x + stripe, 3, frontZ + front * 0.5, 0.2, 0.025, 1.35, stone);
    }
    part('aircon', x + width / 2 + 0.25, 3, z, 0.6, 1, 1.7, stone);
    for(let vent=0;vent<6;vent++) part('aircon-vent',x+width/2+0.56,2.65+vent*0.12,z,0.025,0.04,1.2,metal);
    // Four readable facades: recessed frames, window sills, shutters and small balconies.
    for(const side of [-1,1]) {
      for(let floor=2;floor<height-0.8;floor+=2.4) {
        for(let offset=-depth/2+1.5;offset<depth/2-0.8;offset+=3) {
          const wallX=x+side*(width/2+0.08);
          part('side-window-frame',wallX,floor,z+offset,0.12,1.45,1.5,wood);
          part('side-window',wallX+side*0.07,floor,z+offset,0.04,1.22,1.25,litWindow[(Math.floor(offset+depth)+Math.floor(floor)+palette)%3]!);
          part('side-window-cross',wallX+side*0.1,floor,z+offset,0.06,1.3,0.05,wood);
          part('side-sill',wallX+side*0.12,floor-0.75,z+offset,0.3,0.13,1.7,stone);
        }
      }
      const rear=z-front*(depth/2+0.08);
      for(let offset=-width/2+1.5;offset<width/2-1;offset+=2.5) {
        part('rear-window',x+offset,4,rear,1.35,1.6,0.12,glass);
        part('rear-window-sill',x+offset,3.12,rear,1.6,0.12,0.3,stone);
      }
      const balconyX=x+side*width*0.27;
      part('balcony-floor',balconyX,3.3,frontZ+front*0.55,3,0.18,1.2,stone);
      part('balcony-rail',balconyX,4,frontZ+front*1.15,3,0.07,0.07,metal);
      for(let rail=-1.4;rail<=1.4;rail+=0.35) part('balcony-post',balconyX+rail,3.65,frontZ+front*1.15,0.045,0.7,0.045,metal);
      part('drainpipe',x+side*(width/2-0.2),height/2,frontZ+front*0.2,0.11,height,0.11,metal);
      // Shop glazing and a striped canvas awning stay within the building footprint.
      part('shop-frame',x+side*width*0.29,1.4,frontZ,2.5,2.2,0.13,wood);
      part('shop-glass',x+side*width*0.29,1.4,frontZ+front*0.09,2.25,1.95,0.05,litWindow[0]!);
      part('shop-mullion',x+side*width*0.29,1.4,frontZ+front*0.13,0.08,2,0.05,wood);
      part('shop-shelf',x+side*width*0.29,0.9,frontZ+front*0.16,2.3,0.08,0.2,wood);
      for(let shelf=0;shelf<5;shelf++){
        part('shop-display',x+side*width*0.29-0.85+shelf*0.4,1.03,frontZ+front*0.2,0.2,0.2+(shelf%2)*0.12,0.12,wood);
      }
    }
    // Timber framing and different upper-storey details follow the selected street reference.
    for(const side of [-1,1]) {
      for(let offset=-width/2+0.3;offset<width/2;offset+=width/3) {
        part('timber-upright',x+offset,height/2, z+side*(depth/2+0.1),0.13,height,0.1,wood);
      }
      for(let level=0.8;level<height;level+=2.4){
        if(building.enterable&&side===front&&level<3.4){const w=(width-DOOR_WIDTH)/2;for(const d of [-1,1])part('timber-crossbeam',x+d*(DOOR_WIDTH/2+w/2),level,z+side*(depth/2+.12),w,.12,.12,wood);}
        else part('timber-crossbeam',x,level,z+side*(depth/2+.12),width,.12,.12,wood);
      }
      if(palette===1) {
        part('shutter',x+width*0.3,1.45,z+side*(depth/2+0.18),2.1,2.4,0.1,glass);
        for(let slat=0;slat<12;slat++) part('shutter-slat',x+width*0.3,0.4+slat*0.19,z+side*(depth/2+0.24),2.1,0.035,0.04,metal);
      }
    }
    const buildingMeshes = batch(meshes);
    for (const mesh of buildingMeshes){shadows.addShadowCaster(mesh);mesh.freezeWorldMatrix();}
    occluders.push({ meshes: buildingMeshes,
      min: new Vector3(x - width / 2 - 0.6, 0, z - depth / 2 - 1),
      max: new Vector3(x + width / 2 + 0.6, height + 1, z + depth / 2 + 1),
    });
  }

  for (const cover of COVERS) {
    if(cover.height){
      const h=cover.height,container=cover.id.includes('container'),mat=container?bodyMaterials[cover.x<0?1:2]!:cover.id.includes('monument')?stone:wood;
      const body=box(cover.id,cover.x,h/2,cover.z,cover.width,h,cover.depth,mat);shadows.addShadowCaster(body);
      box(cover.id+'-cap',cover.x,h+.04,cover.z,cover.width+.05,.08,cover.depth+.05,metal);
      for(const side of [-1,1]){
        box(cover.id+'-corner',cover.x+side*(cover.width/2-.08),h/2,cover.z-cover.depth/2-.025,.1,h,.05,metal);
        box(cover.id+'-stripe',cover.x,h*.65,cover.z+side*(cover.depth/2+.015),cover.width*.8,.12,.02,line);
      }
      if(container)for(let n=-cover.width/2+.35;n<cover.width/2;n+=.4)box(cover.id+'-rib',cover.x+n,h/2,cover.z-cover.depth/2-.035,.035,h*.88,.05,metal);
    } else if (cover.id === 'van') {
      const van = box('van-body', cover.x, 1, cover.z, cover.width, 1.8, cover.depth, bodyMaterials[1]!);
      shadows.addShadowCaster(van);
      box('van-roof', cover.x, 2, cover.z + 0.3, 2.5, 0.3, 4.1, stone);
      box('windscreen', cover.x, 1.55, cover.z - 2.51, 2, 0.75, 0.04, glass);
      for (const side of [-1, 1]) for (const axle of [-1.5, 1.5]) {
        const wheel = MeshBuilder.CreateCylinder('wheel', { diameter: 0.75, height: 0.25, tessellation: 10 }, scene);
        wheel.rotation.z = Math.PI / 2; wheel.position.set(cover.x + side * 1.25, 0.4, cover.z + axle);
        wheel.material = metal; wheel.isPickable = false;
      }
    } else {
      box('planter', cover.x, 0.5, cover.z, cover.width, 1, cover.depth, stone);
      box('soil', cover.x, 1.01, cover.z, cover.width - 0.25, 0.1, cover.depth - 0.25, wood);
      for (let n = -1; n <= 1; n++) {
        const bush = MeshBuilder.CreateSphere('bush', { diameter: 1.1, segments: 4 }, scene);
        bush.position.set(cover.x + n, 1.4, cover.z); bush.scaling.y = 0.65;
        bush.material = foliage; bush.isPickable = false;
        for(let petal=0;petal<4;petal++) {
          const flower=MeshBuilder.CreateSphere('flower',{diameter:0.16,segments:6},scene);
          flower.position.set(cover.x+n+Math.sin(petal*2)*0.25,1.72,cover.z+Math.cos(petal*2)*0.25);
          flower.material=petals;flower.isPickable=false;
        }
      }
    }
  }
  for(const [treeIndex,cover] of COVERS.filter(c=>c.id.startsWith('planter-')).entries()) {
    const trunk=MeshBuilder.CreateCylinder('tree-trunk',{diameterTop:0.16,diameterBottom:0.32,height:3.4,tessellation:12},scene);
    trunk.position.set(cover.x,2.7,cover.z);trunk.material=wood;trunk.isPickable=false;
    for(let branch=0;branch<4;branch++) {
      const angle=branch*1.57+treeIndex;
      const path=[new Vector3(cover.x,3.3,cover.z),new Vector3(cover.x+Math.sin(angle)*0.7,4.15,cover.z+Math.cos(angle)*0.7)];
      const limb=MeshBuilder.CreateTube('tree-branch',{path,radius:0.065,tessellation:8},scene);limb.material=wood;limb.isPickable=false;
    }
    for(let cluster=0;cluster<14;cluster++) {
      const angle=cluster*2.4, radius=cluster%3===0?0.45:1.3;
      const leaves=MeshBuilder.CreateSphere('tree-leaves',{diameter:1.7,segments:10},scene);
      leaves.position.set(cover.x+Math.sin(angle)*radius,4.35+(cluster%3)*0.4,cover.z+Math.cos(angle)*radius);
      leaves.scaling.set(1,0.7,0.9);leaves.material=canopyMat;leaves.isPickable=false;
      const positions=leaves.getVerticesData('position')!;
      const colors:number[]=[];
      for(let i=0;i<positions.length;i+=3) {
        const tint=0.68+(positions[i+1]!+0.9)*0.17+(Math.sin(i*3.1)*0.08);
        colors.push(tint,tint+0.04,tint*0.85,1);
      }
      leaves.setVerticesData('color',colors);
    }
    const bench=box('bench-seat',cover.x,0.55,cover.z-1.1,2.6,0.12,0.36,wood);bench.isPickable=false;
  }
  // Lamps are outside collision lanes; emissive pools avoid dozens of expensive lights.
  const poolMat = material('lamp-pool', '#e4b266', '#65431f'); poolMat.alpha = 0.09;
  for (const x of [-43,-10.7, 10.7,43]) for (const z of [-52,-32,-29, -10, 10, 29]) {
    box('lamp-post', x, 2.2, z, 0.12, 4.4, 0.12, metal);
    box('lamp-base',x,0.16,z,0.38,0.32,0.38,metal);
    box('lamp-collar',x,3.9,z,0.21,0.09,0.21,wood);
    const cap=MeshBuilder.CreateCylinder('lantern-roof',{diameterTop:0.12,diameterBottom:0.76,height:0.22,tessellation:4},scene);
    cap.position.set(x,4.65,z);cap.rotation.y=Math.PI/4;cap.material=metal;cap.isPickable=false;
    box('lamp-light',x,4.27,z,0.4,0.5,0.4,warm);
    box('lamp-bottom',x,3.99,z,0.54,0.09,0.54,metal);
    for(const a of [-1,1])for(const b of [-1,1])box('lantern-frame',x+a*0.225,4.28,z+b*0.225,0.035,0.55,0.035,metal);

    const pool = MeshBuilder.CreateDisc('lamp-pool', { radius: 3.5, tessellation: 32 }, scene);
    pool.rotation.x = Math.PI / 2; pool.position.set(x, 0.07, z); pool.material = poolMat; pool.isPickable = false;
  }
  box('harbor-wall', 0, 0.4, 35.5, 130, 0.8, 1, stone);
  box('railing', 0, 1.5, 35.3, 128, 0.08, 0.08, metal);
  for (let x = -63; x <= 63; x += 2) box('rail-post', x, 0.95, 35.3, 0.07, 1.25, 0.07, metal);
  const sea = material('sea', '#18374c', '#05101d');
  const waterNormals=createSurfaceNormals(scene,'water');waterNormals.uScale=16;waterNormals.vScale=12;sea.bumpTexture=waterNormals;
  sea.specularColor = new Color3(0.25, 0.3, 0.38); sea.specularPower = 90;
  box('sea', 0, -1, 99, 400, 0.3, 125, sea);
  const distant = material('distant-city', '#1e2a40');
  for (let i = 0; i < 55; i++) {
    const x = -135 + i * 5;
    const height = 1.8 + (i * 7 % 9)*0.48;
    box('skyline', x, height / 2 - 0.5, 142 + (i % 4) * 4, 3.8, height, 6, distant);
    for (let floor = 1; floor < height; floor += 2) {
      box('distant-window', x, floor, 138.9 + (i % 4) * 4, 0.7, 0.16, 0.06, warm);
    }
    if (i % 2 === 0) {
      for (let j = 0; j < 4; j++) box('reflection', x, -0.81, 132 - j * 4, 0.3 + j * 0.1, 0.02, 1.4, warm);
    }
  }

  const mountainMat=material('mountains','#1b2940','#101929');
  for(let i=0;i<12;i++) {
    const mountain=MeshBuilder.CreateSphere('distant-hill',{diameter:1,segments:12},scene);
    mountain.scaling.set(32+(i%3)*12,12+(i*3%8),13);mountain.position.set(-170+i*30,2,175);
    mountain.material=mountainMat;mountain.isPickable=false;
  }
  for(const x of [-32,32]) {
    box('pier',x,-0.2,48,5,0.3,24,wood);
    for(let z=39;z<60;z+=5) {box('pier-bollard',x+2,0.35,z,0.18,1.2,0.18,metal);box('pier-lamp',x+2,1,z,0.3,0.12,0.3,warm);}
    const hull=MeshBuilder.CreateSphere('boat-hull',{diameter:1,segments:16},scene);
    hull.scaling.set(1.8,0.65,4);hull.position.set(x+5,-0.3,51);hull.material=stone;hull.isPickable=false;
    box('boat-cabin',x+5,0.5,51,1.2,1.1,1.8,wood);box('boat-window',x+5,0.65,49.99,0.8,0.4,0.04,warm);
  }

  const skyDome=MeshBuilder.CreateSphere('night-sky',{diameter:850,segments:32,sideOrientation:Mesh.BACKSIDE},scene);
  const skyMat=material('night-sky-material','#ffffff','#ffffff');skyMat.disableLighting=true;skyMat.specularColor.set(0,0,0);
  const positions=skyDome.getVerticesData('position')!;
  const skyColors:number[]=[];
  for(let i=0;i<positions.length;i+=3) {
    const t=Math.min(1,Math.abs(positions[i+1]!)/180);
    skyColors.push(0.22*(1-t)+0.025*t,0.29*(1-t)+0.055*t,0.4*(1-t)+0.13*t,1);
  }
  skyDome.setVerticesData('color',skyColors);skyDome.material=skyMat;skyDome.isPickable=false;

  const player = new TransformNode('player', scene);
  const previewLight = new PointLight('character-softbox',new Vector3(0,3,0),scene);
  previewLight.diffuse=Color3.FromHexString('#d5ecff');previewLight.intensity=1.2;previewLight.range=8;previewLight.setEnabled(false);
  const accent = material('avatar-accent', '#65cbd4', '#164952');
  let character = createCharacter(scene, player, 'robot');
  const plinth = MeshBuilder.CreateCylinder('preview-plinth',{diameter:2.1,height:0.12,tessellation:64},scene);
  plinth.position.y=-0.065;plinth.material=metal;plinth.parent=player;plinth.isPickable=false;
  for (const mesh of character.meshes) shadows.addShadowCaster(mesh);
  function selectCharacter(type: CharacterType) {
    if (character.type === type) return;
    for (const mesh of character.meshes) shadows.removeShadowCaster(mesh);
    lobbyWeapons.attach(null);character.root.dispose();
    character = createCharacter(scene, player, type);lobbyWeapons.attach(character.weaponSocket);
    for (const mesh of character.meshes) shadows.addShadowCaster(mesh);
  }
  const viewModel = new TransformNode('first-person-hands', scene);
  viewModel.parent = camera;
  const gun = box('view-gun', 0.27, -0.23, 0.65, 0.12, 0.13, 0.4, metal); gun.parent = viewModel;
  const barrel = box('view-barrel', 0.27, -0.2, 0.93, 0.065, 0.065, 0.24, metal); barrel.parent = viewModel;
  const sight = box('view-sight', 0.27, -0.145, 0.8, 0.035, 0.035, 0.035, accent); sight.parent = viewModel;
  const hand = box('view-hand', 0.27, -0.34, 0.55, 0.15, 0.24, 0.18, metal); hand.parent = viewModel;
  const gunIvory=material('gun-ivory','#bfc6ca');
  const gunCopper=material('gun-copper','#b29b73');
  const glove=material('view-glove','#d9d6c5');
  for(const [name,x,y,z,w,h,d,mat] of [
    ['receiver',0.27,-0.17,0.64,0.14,0.08,0.42,gunIvory],
    ['slide-rail',0.27,-0.125,0.65,0.09,0.025,0.34,metal],
    ['grip',0.27,-0.32,0.5,0.09,0.24,0.13,metal],
    ['side-inlay',0.345,-0.19,0.62,0.015,0.035,0.2,gunCopper],
    ['glove-back',0.27,-0.34,0.51,0.17,0.18,0.12,glove],
  ] as const) { const detail=box(`view-${name}`,x,y,z,w,h,d,mat);detail.parent=viewModel; }
  for(let i=0;i<3;i++) {const finger=box('view-finger',0.21+i*0.055,-0.3,0.61,0.045,0.07,0.1,glove);finger.parent=viewModel;}
  const muzzle=MeshBuilder.CreateCylinder('view-muzzle',{diameter:0.105,height:0.12,tessellation:24},scene);
  muzzle.rotation.x=Math.PI/2;muzzle.position.set(0.27,-0.2,1.035);muzzle.parent=viewModel;muzzle.material=metal;muzzle.isPickable=false;
  const muzzleInset=MeshBuilder.CreateCylinder('view-bore',{diameter:0.055,height:0.01,tessellation:20},scene);
  muzzleInset.rotation.x=Math.PI/2;muzzleInset.position.set(0.27,-0.2,1.1);muzzleInset.parent=viewModel;muzzleInset.material=glass;muzzleInset.isPickable=false;
  const scopeBody=MeshBuilder.CreateCylinder('weapon-scope',{diameter:.1,height:.32,tessellation:16},scene);
  scopeBody.parent=viewModel;scopeBody.position.set(.27,-.06,.68);scopeBody.rotation.x=Math.PI/2;scopeBody.material=metal;scopeBody.isPickable=false;
  const secondBarrel=box('shotgun-second-barrel',.36,-.2,.9,.07,.07,.42,metal);secondBarrel.parent=viewModel;secondBarrel.isPickable=false;
  const launcher=MeshBuilder.CreateCylinder('view-launcher',{diameter:.26,height:1.04,tessellation:16},scene);launcher.rotation.x=Math.PI/2;launcher.position.set(.27,-.18,.73);launcher.parent=viewModel;launcher.material=metal;launcher.isPickable=false;const launcherRim=MeshBuilder.CreateCylinder('view-launcher-rim',{diameter:.31,height:.07,tessellation:16},scene);launcherRim.rotation.x=Math.PI/2;launcherRim.position.set(.27,-.18,1.26);launcherRim.parent=viewModel;launcherRim.material=gunCopper;launcherRim.isPickable=false;
  // Camera-held hands/gun must keep their own depth without being sliced by nearby walls.
  // Lobby and opponent weapons remain in the world rendering group.
  scene.setRenderingAutoClearDepthStencil(1,true,true,true);
  for(const mesh of viewModel.getChildMeshes()){
    mesh.renderingGroupId=1;mesh.isPickable=false;mesh.receiveShadows=false;
  }
  const lobbyWeapons=createLobbyWeapons(scene);lobbyWeapons.attach(character.weaponSocket);for(const mesh of lobbyWeapons.meshes)shadows.addShadowCaster(mesh);
  addStreetDetails(scene);
  const buildingParts = new Set(occluders.flatMap(building => building.meshes));
  const dynamicDoors=new Set(doorMeshes.values());
  const staticMeshes=batch(scene.meshes.filter((mesh): mesh is Mesh => mesh instanceof Mesh
    && !mesh.parent && !dynamicDoors.has(mesh) && !buildingParts.has(mesh) && mesh.material !== poolMat && mesh !== skyDome));
  for(const mesh of staticMeshes)mesh.freezeWorldMatrix();
  for(const mesh of staticMeshes) if(mesh.material===canopyMat || mesh.material===wood) shadows.addShadowCaster(mesh);
  for (const mesh of scene.meshes) {
    if (mesh instanceof Mesh && !mesh.parent && mesh.material !== poolMat && mesh !== skyDome) mesh.isPickable = true;
  }
  const mapArt = options.mapArtSource && options.map !== 'factory'
    ? createHarborMapArt(scene, options.mapArtSource, scene.meshes.filter(mesh => !mesh.parent && mesh !== skyDome),
      BUILDINGS, () => doors, shadows)
    : undefined;
  const targets = [{ x: 0, z: 32 }, { x: -25, z: 12 }, { x: 25, z: 12 }].map((p, index) => {
    const root=new TransformNode(`target-root-${index}`,scene);
    const targetMat = material(`target-${index}`, '#da8d61', '#543524');
    const target = MeshBuilder.CreateCylinder(`practice-target-${index}`, { diameter: 1.5, height: 0.18, tessellation: 24 }, scene);
    target.rotation.x = Math.PI / 2; target.position.set(p.x, 1.9, p.z);
    target.material = targetMat; target.isPickable = true;
    target.metadata = { practiceTarget: true, targetIndex: index };
    const post = box(`target-post-${index}`, p.x, 0.8, p.z, 0.15, 1.6, 0.15, metal); post.isPickable = true;
    const center = MeshBuilder.CreateCylinder(`target-center-${index}`, { diameter: 0.45, height: 0.2, tessellation: 24 }, scene);
    center.rotation.x = Math.PI / 2; center.position.set(p.x, 1.9, p.z - 0.02); center.material = accent;
    center.isPickable = true; center.metadata = { practiceTarget: true, targetIndex: index };
    const healthBack=box(`target-health-back-${index}`,p.x,2.88,p.z,1.6,0.12,0.055,metal);
    const healthBar=box(`target-health-fill-${index}`,p.x,2.88,p.z-0.04,1.5,0.08,0.03,accent);
    for(const mesh of [target,post,center,healthBack,healthBar])mesh.parent=root;
    healthBack.isPickable=false;healthBar.isPickable=false;
    return { mat: targetMat, flash: 0,root,healthBar,x:p.x,z:p.z,health:PRACTICE_RULES.maxHealth };

  });
  const atmosphere=createAtmosphere(scene);
  const botFlashes=new Map<string,number>();
  let botDifficulty:SurvivalDifficulty='easy';const fixedDifficulty=()=>botDifficulty==='auto'?'normal':botDifficulty;const environment={doors,randomSpawns:options.randomSpawns!==false};let duel=createDuel(fixedDifficulty(),environment.randomSpawns?randomOutdoorSpawn([PROTOTYPE.spawn]):{x:0,z:18},undefined,environment),ffa=createBotMatch(fixedDifficulty(),environment),survival=createSurvivalMatch(botDifficulty,undefined,environment),duelMode=false,ffaMode=false,survivalMode=false;
  function battleState(){if(survivalMode)return survival.state();if(ffaMode)return ffa.state();const state=duel.state();return {...state,mode:'duel' as const,winnerName:state.winner==='player'?'나':'봇',bots:[] as ReturnType<typeof ffa.state>['bots']};}
  const botParent=new TransformNode('opponent',scene);
  const opponent=createCharacter(scene,botParent,'robot-cat');
  for(const mesh of opponent.meshes){mesh.isPickable=true;mesh.metadata={opponent:true,botId:'bot-1'};shadows.addShadowCaster(mesh);}
  const opponentMark=box('opponent-marker',0,2.6,0,0.7,0.08,0.08,material('opponent-red','#ff856d','#f74f2d'));
  opponentMark.parent=botParent;opponentMark.isPickable=false;
  const botGun=box('opponent-pistol',0.32,1.65,0.65,0.14,0.16,0.5,metal);
  botGun.parent=opponent.root;botGun.isPickable=true;botGun.metadata={opponent:true,botId:'bot-1'};
  const opponentBody=[...opponent.meshes,botGun];
  const robotImpact=createRobotImpact(scene,opponent.root,opponentBody);
  botParent.setEnabled(false);
  const botEffects=createShotEffects(scene,camera);
  const warningMat=material('incoming-warning','#ff9d59','#ff5935');warningMat.alpha=0.65;
  const warningRing=MeshBuilder.CreateTorus('incoming-shot-ring',{diameter:1.3,thickness:0.055,tessellation:32},scene);
  warningRing.material=warningMat;warningRing.isPickable=false;warningRing.setEnabled(false);
  const soundEvents:{kind:Sound;x:number;z:number}[]=[];
  type BotRig={id:string;parent:TransformNode;body:Mesh[];mark:Mesh;fx:ReturnType<typeof createRobotImpact>;health:number};
  const botRigs:BotRig[]=[{id:'bot-1',parent:botParent,body:opponentBody,mark:opponentMark,fx:robotImpact,health:100}];
  function ensureBotRigs(){
    if(botRigs.length===3)return;
    for(let i=2;i<=3;i++){
      const parent=new TransformNode(`opponent-bot-${i}`,scene),model=createCharacter(scene,parent,i===2?'robot':'robot-cat');
      const gun=box(`bot-${i}-pistol`,.32,1.65,.65,.14,.16,.5,metal);gun.parent=model.root;
      const body=[...model.meshes,gun];for(const mesh of body){mesh.isPickable=true;mesh.metadata={opponent:true,botId:`bot-${i}`};shadows.addShadowCaster(mesh);}
      const tint=i===2?'#67c8ff':'#ffe282',mark=box(`bot-${i}-marker`,0,2.6,0,.7,.08,.08,material(`bot-${i}-mark`,tint,tint));mark.parent=parent;mark.isPickable=false;
      const fx=createRobotImpact(scene,model.root,body,{particleLimit:12});fx.setQuality(onlineQualityHigh);botRigs.push({id:`bot-${i}`,parent,body,mark,fx,health:100});
    }
  }
  let seenRespawn=0,seenResupply=0;
  function syncBot(){
    const state=battleState();if(ffaMode||survivalMode)ensureBotRigs();
    warningRing.setEnabled(duelMode&&!!state.locked&&!preview&&!reference);
    if(state.locked){warningRing.position.set(state.locked.x,.07,state.locked.z);warningRing.scaling.setAll(1+state.warning);}
    for(const rig of botRigs){
      const bot=ffaMode||survivalMode?state.bots.find(b=>b.id===rig.id):rig.id==='bot-1'?{health:state.botHealth,position:state.position,locked:state.locked}:undefined;
      if(!bot){rig.parent.setEnabled(false);continue;}
      if(rig.health===0&&bot.health>0){rig.fx.reset();botFlashes.delete(rig.id);}rig.health=bot.health;const alive=bot.health>0;
      for(const mesh of rig.body)mesh.isPickable=alive;
      rig.mark.setEnabled(alive);rig.mark.scaling.y=bot.locked?2.5:1;rig.mark.scaling.x=Math.max(.001,bot.health/100);
      rig.parent.setEnabled(duelMode&&(alive||rig.fx.showingDeath)&&!preview&&!reference);rig.parent.position.set(bot.position.x,bot.position.y??0,bot.position.z);
      rig.parent.rotation.y=Math.atan2(camera.position.x-bot.position.x,camera.position.z-bot.position.z);rig.parent.computeWorldMatrix(true);
    }
  }
  const matchPickups=()=>options.randomSpawns===false?createPickups():createMatchPickups(geometry);
  let localActor:GearActor={id:'player',...PROTOTYPE.spawn,yaw:0,pitch:0,health:100,gear:createGear(),healing:0,flash:0,gearCooldown:0};
  let localProjectiles:Projectile[]=[],toolSequence=0,toolDamageVersion=0,lastToolHealth=100;
  const toolVisuals=createEquipmentVisuals(scene);
  let upgradeTier=0;
  const localSpec=(id:WeaponId)=>upgradedWeapon(id,upgradeTier,duelMode);
  let weaponId:WeaponId='pistol',startWeapon:WeaponId='pistol',spec=WEAPONS.pistol,cooldown=0,scoped=false;let inventory=createInventory(startWeapon),pickups=matchPickups();
  let weapon=createWeapon(spec);
  let jumpState=createJump(),falling=false;
  let hits=0,destroyed=0,shots=0;
  const effects=createShotEffects(scene,camera);
  let preview = false, reference = false, lobbyPreview=false,lobbyMotion=true,lobbyTime=0,lobbyYaw=0,lobbyWeaponId:WeaponId='pistol';
  const recoil=createRecoil();let reducedShots=false;
  function equip(){const slot=inventory.slots[inventory.active]!;weaponId=slot.id;spec=localSpec(weaponId);weapon=slot.weapon;cooldown=slot.cooldown;scoped=false;recoil.clear();}
  const supplies=createSupplyCrates(scene,matchPickups());
  function syncSupplies(){supplies.update(pickups,!preview&&!reference);}
  let animationTime = 0;
  function resize() { camera.getProjectionMatrix(true); }
  function setReference(value: boolean) {
    effects.clear();botEffects.clear();robotImpact.clearParticles();for(const rig of botRigs.slice(1))rig.fx.clearParticles();recoil.clear();reference=value;player.setEnabled(value);plinth.setEnabled(false);viewModel.setEnabled(!value);
    lobbyWeapons.show(lobbyWeaponId,false);character.poseLobby(false);
    camera.fov=value?0.95:1.25;camera.getProjectionMatrix(true);
  }
  function setPreview(value: boolean,lobby=false) {
    lobbyPreview=value&&lobby;lobbyYaw=0;lobbyTime=0;character.poseLobby(lobbyPreview,0,lobbyWeaponId!=='pistol');lobbyWeapons.show(lobbyWeaponId,lobbyPreview);
    effects.clear();botEffects.clear();robotImpact.clearParticles();for(const rig of botRigs.slice(1))rig.fx.clearParticles();recoil.clear();reference=false;preview = value;plinth.setEnabled(value); player.setEnabled(value); viewModel.setEnabled(!value);
    camera.fov=value?(lobbyPreview?.65:.85):1.25;camera.getProjectionMatrix(true);
    previewLight.setEnabled(value);
    for(const light of streetLights) light.setEnabled(!value);
  }
  const autoShotResults:ReturnType<typeof shoot>[]=[];
  const highShotNotices:string[]=[];const botReveals=new Map<string,number>();let stance:Stance='stand';
  function update(p: Point, dt: number, look: Look = { yaw: 0, pitch: 0 }, paused=false) {
    if(!paused){for(const [id,left] of botReveals){if(left<=dt)botReveals.delete(id);else botReveals.set(id,left-dt);}}
    if(!paused&&!preview&&!reference){
      if(stance==='stand')delete p.stance;else p.stance=stance;
      const vertical=geometry.advanceJumpOnTerrain(p,jumpState,dt);
      Object.assign(p,vertical.position);jumpState=vertical.jump;falling=(p.fallSpeed??0)>0;
      syncSlot(inventory,weapon,cooldown);advanceStowed(inventory,dt);tickPickups(pickups,dt);weapon=advanceWeapon(weapon,dt,spec);if(weaponId==='smg')weapon={...weapon,cadenceCarry:cadenceCarry(cooldown,dt)};cooldown=Math.max(0,cooldown-dt);
    }
    syncDoors();if(!paused)atmosphere.update(dt,p);
    const texel=64/shadows.mapSize;
    moon.position.set(Math.round((p.x+24.75)/texel)*texel,55,Math.round((p.z-13.75)/texel)*texel);
    waterNormals.uOffset+=paused?0:Math.min(dt,.1)*.012;
    const active=!paused&&!preview&&!reference;
    if(active){animationTime+=dt;recoil.update(dt);robotImpact.update(dt);if(ffaMode||survivalMode)for(const rig of botRigs.slice(1))rig.fx.update(dt);}
    const kick=recoil.read();
    viewModel.position.z=0.18-kick.push;
    const reloadMotion=weapon.reloadRemaining>0?Math.sin((1-weapon.reloadRemaining/spec.reloadSeconds)*Math.PI):0;
    viewModel.position.y=-0.055+Math.sin(animationTime*1.8)*0.002-reloadMotion*0.16;
    viewModel.rotation.z=-reloadMotion*0.3;
    viewModel.rotation.x=-kick.tilt;
    if(!paused&&!preview&&!reference)effects.update(dt);
    for (const target of targets) {
      target.flash = Math.max(0, target.flash - dt);
      target.mat.emissiveColor = Color3.FromHexString(target.flash > 0 ? '#67d6ca' : '#543524');
    }
    if(duelMode&&!paused&&!preview&&!reference){
      botEffects.update(dt);
      const wasBotDead=battleState().botHealth===0;
      const updateBattle=survivalMode?survival.update:ffaMode?ffa.update:duel.update;
      updateBattle(dt,p,(point:Point,botId?:string)=>{
        if((botFlashes.get(botId??'bot-1')??0)>.05)return false;
        const from=new Vector3(point.x,1.8+(point.y??0),point.z),to=new Vector3(p.x,1.95+(p.y??0)+jumpState.height,p.z);
        return unobstructed(geometry,doors,from,to);
      },(point,target)=>{
        if((point.y??0)>=3.35){const b=battleState(),actor=b.bots.find(a=>Math.hypot(a.position.x-point.x,a.position.z-point.z)<.1);botReveals.set(actor?.id??'bot-1',4);if(highShotNotices.length<8)highShotNotices.push('고층 사격 감지 · 미니맵에 4초간 표시');}
        const start=new Vector3(point.x,1.8+(point.y??0),point.z),end=new Vector3(target.x,1.8+(target.y??0),target.z);
        const delta=end.subtract(start);
        const nearest=firstShotBox(geometry,doors,start,end);
        const clear=!nearest,impact=nearest?start.add(delta.scale(nearest.t)):end;
        const normal=delta.normalize().scale(-1);
        if(nearest){normal.set(0,0,0);if(nearest.axis===0)normal.x=delta.x>0?-1:1;else if(nearest.axis===1)normal.y=delta.y>0?-1:1;else normal.z=delta.z>0?-1:1;}
        if(soundEvents.length<16)soundEvents.push({kind:'pistol',x:point.x,z:point.z});
        botEffects.emit(start,impact,normal,!clear,false);
        return clear;
      });
      const state=battleState();
      if(state.mode==='survival'&&state.ammoRefreshVersion!==seenResupply){seenResupply=state.ammoRefreshVersion;syncSlot(inventory,weapon,cooldown);for(const slot of inventory.slots)slot.weapon=createWeapon(WEAPONS[slot.id]);weapon=inventory.slots[inventory.active]!.weapon;}
      if(wasBotDead&&state.botHealth>0){robotImpact.reset();botFlashes.delete('bot-1');}
      if(state.respawnVersion!==seenRespawn){seenRespawn=state.respawnVersion;p.x=state.playerPosition.x;p.z=state.playerPosition.z;if(p.y!==undefined)p.y=0;p.fallSpeed=0;falling=false;weaponId=startWeapon;spec=localSpec(weaponId);inventory=createInventory(startWeapon);weapon=createWeapon(spec);if(survivalMode)pickups=pickups.map(c=>({...c,remaining:0}));localActor.gear=createGear();localActor.healing=0;localActor.flash=0;cooldown=0;scoped=false;jumpState=createJump();recoil.clear();}
    }
    if(!duelMode&&!paused&&!preview&&!reference){duel.update(dt,p,()=>false,()=>false,false);const d=duel.state();if(d.respawnVersion!==seenRespawn){seenRespawn=d.respawnVersion;p.x=d.playerPosition.x;p.z=d.playerPosition.z;p.y=0;inventory=createInventory(startWeapon);equip();localActor.gear=createGear();localActor.healing=0;localActor.flash=0;}}
    if(!paused&&!preview&&!reference){
      const battle=battleState(),group=survivalMode?survival:ffaMode?ffa:duel;
      if(battle.damageVersion!==toolDamageVersion){localActor.healing=0;toolDamageVersion=battle.damageVersion;}
      if(lastToolHealth>0&&battle.playerHealth<=0){localActor.gear=createGear();localActor.healing=0;}
      Object.assign(localActor,{stance,jump:jumpState,x:p.x,y:p.y??0,z:p.z,yaw:look.yaw,pitch:look.pitch,health:battle.playerHealth,protection:battle.protection});
      const bots:GearActor[]=duelMode?(battle.mode==='duel'?[{id:'bot-1',...battle.position,health:battle.botHealth}]:battle.bots.map(b=>({id:b.id,...b.position,health:b.health}))).map(b=>({...b,yaw:Math.atan2(p.x-b.x,p.z-b.z),pitch:0,gear:createGear(),healing:0,flash:botFlashes.get(b.id)??0,gearCooldown:0})):targets.map((t,i)=>({id:'target-'+i,x:t.x,y:0,z:t.z,yaw:0,pitch:0,health:t.health,gear:createGear(),healing:0,flash:0,gearCooldown:0}));
      const events=advanceEquipment([localActor,...bots],localProjectiles,dt,geometry,doors,(target,amount)=>{
       if(target.id==='player'){group.hurtSelf(amount);localActor.health=group.state().playerHealth;if(localActor.health<=0)localActor.gear=createGear();}
       else if(target.id.startsWith('target-')){const t=targets[Number(target.id.slice(7))]!;const before=t.health;t.health=Math.max(0,t.health-amount);target.health=t.health;if(before>t.health){hits++;t.flash=.16;}if(before>0&&t.health===0){destroyed++;t.root.setEnabled(false);}t.healthBar.scaling.x=Math.max(.001,t.health/100);}
       else {if(battle.mode==='duel')duel.hurt('bot',amount);else if(survivalMode)survival.hurt(target.id,amount);else ffa.hurt(target.id,amount);const next=battleState();target.health=next.mode==='duel'?next.botHealth:next.bots.find(b=>b.id===target.id)?.health??0;}
      },()=>++toolSequence);
      const actual=group.state().playerHealth;if(localActor.health>actual)group.healPlayer(localActor.health-actual);localActor.health=group.state().playerHealth;lastToolHealth=localActor.health;for(const b of bots)botFlashes.set(b.id,b.flash);for(const e of events)if(soundEvents.length<16)soundEvents.push({kind:e.kind,x:e.x,z:e.z});toolVisuals.update(localProjectiles,events,dt);
    }
    const displayPoint=preview&&lobbyPreview?PROTOTYPE.spawn:p;
    player.position.x = displayPoint.x; player.position.z = displayPoint.z;
    player.position.y=preview||reference?0:(p.y??0)+jumpState.height;
    player.rotation.y = look.yaw;
    if(reference) {
      camera.position.set(42,50,-60);camera.setTarget(new Vector3(0,0,7));
    } else if (preview) {
      camera.position.set(displayPoint.x+(lobbyPreview?.7:1.7),lobbyPreview?1.7:2,displayPoint.z+(lobbyPreview?6.5:4.3));
      if(lobbyPreview&&lobbyMotion)lobbyTime+=Math.max(0,Math.min(.05,dt));
      character.poseLobby(lobbyPreview,lobbyMotion?lobbyTime:0,lobbyWeaponId!=='pistol');lobbyWeapons.show(lobbyWeaponId,lobbyPreview);
      player.rotation.y=lobbyPreview?lobbyYaw-.1+(lobbyMotion?Math.sin(lobbyTime*.8)*.018:0):Math.sin(animationTime*0.5)*0.12-.1;
      previewLight.position.set(displayPoint.x+1,3.8,displayPoint.z+3);
      camera.setTarget(new Vector3(displayPoint.x+(lobbyPreview?0:1.25),lobbyPreview?1.4:1.35,displayPoint.z));
    } else {
      camera.position.set(p.x,(stanceStats(stance).eye-(character.type==='robot-cat'?.05:0))+(p.y??0)+jumpState.height,p.z);
      camera.fov=(scoped?.38:1.25)+(reducedShots?0:kick.fov);viewModel.setEnabled(!scoped);
      camera.rotation.set(look.pitch, look.yaw, reducedShots?0:kick.roll);
    }
    launcher.setEnabled(weaponId==='bazooka');launcherRim.setEnabled(weaponId==='bazooka');muzzle.setEnabled(weaponId!=='bazooka');muzzleInset.setEnabled(weaponId!=='bazooka');
    scopeBody.setEnabled(weaponId==='sniper');secondBarrel.setEnabled(weaponId==='shotgun');
    gun.scaling.z=weaponId==='pistol'?1:weaponId==='smg'?1.2:weaponId==='dmr'?1.9:1.6;barrel.scaling.z=weaponId==='sniper'?2:weaponId==='dmr'?1.8:weaponId==='pistol'?1:weaponId==='smg'?1.2:1.5;
    const inside=indoorAt(p);for(const item of interiorLights)item.light.setEnabled(!preview&&!reference&&item.id===inside?.id);
    syncBot();syncSupplies();
    if(active){const sequence=advanceBurst(weapon,dt);weapon=sequence.state;if(sequence.due>0){const shot=shoot(true);if(shot.fired)autoShotResults.push(shot);else weapon=cancelBurst(weapon);}}
  }
  setPreview(false);
  resize();
  function shoot(continued=false) {
    if (preview || reference || (battleState().playerHealth===0||!!battleState().winner)) return { fired: false, hit: false };
    if(!continued&&cooldown>1e-8)return {fired:false,hit:false,reason:'cooldown'};
    const attempt=tryFire(weapon);weapon=attempt.state;
    if(!attempt.fired)return {fired:false,hit:false,reason:attempt.reason};
    if(camera.position.y-stanceStats(stance).eye-jumpState.height>=3.35&&highShotNotices.length<8)highShotNotices.push('고층 사격 · 내 위치가 4초간 노출됩니다');
    (survivalMode?survival:ffaMode?ffa:duel).playerFired();localActor.healing=0;shots++;recoil.fire(weaponId);if(!continued){cooldown=Math.max(0,spec.interval-(weaponId==='smg'?(weapon.cadenceCarry??0):0));weapon=startBurst(weapon,spec);}
    if(weaponId==='bazooka'){launchRocket({...localActor,x:camera.position.x,y:camera.position.y-stanceStats(stance).eye,stance,z:camera.position.z,jump:{height:0},yaw:camera.rotation.y,pitch:camera.rotation.x},localProjectiles,++toolSequence,spec.damage);return {fired:true,hit:false,eliminated:false,damage:0,impact:false,point:camera.position.clone()};}
    let anyHit=false,anyEliminated=false,impact=false,totalDamage=0;
    let lastPoint=camera.position.clone();
    const offsets=pelletOffsets(spec);
    for(let pellet=0;pellet<offsets.length;pellet++){
    const offset=offsets[pellet]!;
    const direction = camera.getDirection(Vector3.Forward()).add(camera.getDirection(Vector3.Right()).scale(offset.x)).add(camera.getDirection(Vector3.Up()).scale(offset.y)).normalize();
    const ray = new Ray(camera.position.clone(), direction, 150);
    const pick = scene.pickWithRay(ray, mesh => mesh.isPickable && mesh.isEnabled());
    const end = pick?.pickedPoint ?? camera.position.add(direction.scale(150));
    muzzleInset.computeWorldMatrix(true);
    let start=muzzleInset.getAbsolutePosition().clone();
    const originDirection=start.subtract(camera.position),originDistance=originDirection.length();
    if(originDistance>0.001){
      const blockedOrigin=scene.pickWithRay(new Ray(camera.position.clone(),originDirection.scale(1/originDistance),originDistance),mesh=>mesh.isPickable&&mesh.isEnabled());
      if(blockedOrigin?.pickedPoint)start=blockedOrigin.pickedPoint.subtract(originDirection.scale(0.03/originDistance));
    }
    const hit = duelMode ? pick?.pickedMesh?.metadata?.opponent === true : pick?.pickedMesh?.metadata?.practiceTarget === true;
    let eliminated=false;
    if(hit&&duelMode){
      const id=String(pick!.pickedMesh!.metadata.botId??'bot-1'),multi=ffaMode||survivalMode,group=survivalMode?survival:ffa;
      const before=multi?group.state().bots.find(b=>b.id===id)!.health:battleState().botHealth;
      const head=/^(robot-(head|screen|eye|ear)|cat-(head|face|eye|cheek|nose|forehead)|welding-(mask|visor|filter))/.test(pick!.pickedMesh!.name);const damageAmount=spec.damage*(head?1.5:1);eliminated=multi?group.hurt(id,damageAmount):duel.hurt('bot',damageAmount);
      const after=multi?group.state().bots.find(b=>b.id===id)!.health:battleState().botHealth,damage=before-after;totalDamage+=damage;
      const rig=botRigs.find(b=>b.id===id);if(damage>0&&rig)rig.fx.hit(end,end.x-rig.parent.position.x,eliminated);syncBot();
    }
    if(hit&&!duelMode) {
      const target=targets[pick!.pickedMesh!.metadata.targetIndex]!;
      const damage=applyDamage(target.health,spec.damage);totalDamage+=target.health-damage.health;
      target.health=damage.health;target.flash=0.16;hits++;
      const fraction=target.health/PRACTICE_RULES.maxHealth;
      target.healthBar.scaling.x=Math.max(0.001,fraction);
      target.healthBar.position.x=target.x-0.75*(1-fraction);
      eliminated=damage.eliminated;
      if(eliminated){target.root.setEnabled(false);destroyed++;}
    }
    effects.emit(start,end,pick?.getNormal(true)??direction.scale(-1),pick?.hit===true,hit,pellet===0);
    impact=impact||pick?.hit===true;
    anyHit=anyHit||hit;anyEliminated=anyEliminated||eliminated;lastPoint=end;
    }
    return { fired: true, hit:anyHit, eliminated:anyEliminated, damage:totalDamage,impact,point:lastPoint };
  }
  function reload() {
    if(preview||reference||(battleState().playerHealth===0||!!battleState().winner))return false;
    const next=beginReload(weapon,spec);const started=next!==weapon;weapon=started?cancelBurst(next):next;return started;
  }
  function resetPractice() {
    localActor={id:'player',...PROTOTYPE.spawn,yaw:0,pitch:0,health:100,gear:createGear(),healing:0,flash:0,gearCooldown:0};localProjectiles=[];toolSequence=0;toolDamageVersion=0;lastToolHealth=100;botFlashes.clear();toolVisuals.clear();
    highShotNotices.length=0;botReveals.clear();autoShotResults.length=0;weaponId=startWeapon;spec=localSpec(weaponId);inventory=createInventory(startWeapon);pickups=matchPickups();weapon=createWeapon(spec);cooldown=0;scoped=false;jumpState=createJump();falling=false;hits=0;destroyed=0;shots=0;
    effects.clear();botEffects.clear();recoil.clear();robotImpact.reset();doors=createDoors();environment.doors=doors;duel=createDuel(fixedDifficulty(),environment.randomSpawns?randomOutdoorSpawn([PROTOTYPE.spawn]):{x:0,z:18},undefined,environment);ffa=createBotMatch(fixedDifficulty(),environment);survival=createSurvivalMatch(botDifficulty,undefined,environment);syncDoors();seenResupply=0;for(const rig of botRigs){rig.fx.reset();rig.health=100;}seenRespawn=0;syncBot();
    for(const target of targets){
      target.health=PRACTICE_RULES.maxHealth;target.flash=0;target.root.setEnabled(!duelMode);
      target.healthBar.scaling.x=1;target.healthBar.position.x=target.x;
    }
  }
  const remoteModels=createRemoteModels(scene);
  type RemoteRig={model:RemoteModel;fx:ReturnType<typeof createRobotImpact>;parent:TransformNode;type:CharacterType;health:number;marker:Mesh;castsShadow:boolean};
  const remotes=new Map<string,RemoteRig>(),remoteParent=new TransformNode('online-opponent',scene);
  const friendMat=material('online-friendly','#6edec6','#1f806c'),enemyMat=material('online-enemy','#ff9a76','#8d3020');
  let lastNetworkEvent=-1,onlineQualityHigh=true,networkJumpTick=-1,networkJumpAge=0;
  function removeRemote(id:string){const r=remotes.get(id);if(!r)return;for(const mesh of r.model.meshes)shadows.removeShadowCaster(mesh);r.fx.dispose();r.parent.dispose();remotes.delete(id);}
  function endOnline(preserveJump=false){toolVisuals.clear();for(const key of [...remotes.keys()])removeRemote(key);remoteModels.clear();remoteParent.setEnabled(false);lastNetworkEvent=-1;if(!preserveJump){networkJumpTick=-1;networkJumpAge=0;}effects.clear();botEffects.clear();recoil.clear();}
  let lowPerformance=false,requestedShadows=true;
  const surfaceNormals=new Map(scene.materials.filter((m):m is StandardMaterial=>m instanceof StandardMaterial&&!!m.bumpTexture).map(m=>[m,m.bumpTexture]));
  function applySurfaceQuality(){
    for(const [material,normal] of surfaceNormals)material.bumpTexture=lowPerformance?null:normal;
    for(const texture of scene.textures)texture.anisotropicFilteringLevel=lowPerformance?2:onlineQualityHigh?8:4;
  }
  function renderOnline(state:MatchState,id:string,look:Look,dt:number,predictedPosition?:Point,remotePosition?:(Point&{id:string})|Array<Point&{id:string}>,predictedJump?:JumpState){
    const me=state.players.find(p=>p.id===id);if(!me)return;stance=me.stance??'stand';remoteParent.setEnabled(true);doors=state.doors??{};environment.doors=doors;
    duelMode=false;ffaMode=false;survivalMode=false;preview=false;reference=false;lobbyWeapons.show(lobbyWeaponId,false);character.poseLobby(false);if(weaponId!==me.weaponId||me.health===0)scoped=false;weaponId=me.weaponId;spec=WEAPONS[weaponId];weapon={...me.weapon};cooldown=me.cooldown;if(networkJumpTick!==state.tick){networkJumpTick=state.tick;networkJumpAge=0;}else networkJumpAge=Math.min(.15,networkJumpAge+dt);jumpState=predictedJump??advanceJump(me.jump,networkJumpAge);falling=(me.fallSpeed??0)>0;inventory=me.inventory??createInventory(me.weaponId);pickups=state.pickups??[];
    recoil.update(dt);effects.update(dt);botEffects.update(dt);update(predictedPosition??me,0,look,true);toolVisuals.update(state.projectiles??[],state.toolEvents??[],dt);for(const target of targets)target.root.setEnabled(false);
    const estimates=new Map((Array.isArray(remotePosition)?remotePosition:remotePosition?[remotePosition]:[]).map(p=>[p.id,p]));const ids=new Set(state.players.filter(p=>p.id!==id&&!p.abandoned).map(p=>p.id));for(const key of remotes.keys())if(!ids.has(key))removeRemote(key);
    for(const other of state.players){if(other.id===id||other.abandoned)continue;let rig=remotes.get(other.id);
      if(!rig||rig.type!==other.character){removeRemote(other.id);const parent=new TransformNode('online-player-'+other.id,scene);parent.parent=remoteParent;const model=remoteModels.create(parent,other.character,other.weaponId!=='pistol'),body=model.meshes;
       const fx=createRobotImpact(scene,model.root,body,{particleLimit:12});fx.setQuality(onlineQualityHigh);const marker=MeshBuilder.CreateBox('team-marker',{width:.45,height:.07,depth:.1},scene);marker.parent=parent;marker.position.y=2.95;marker.isPickable=false;rig={model,fx,parent,type:other.character,health:other.health,marker,castsShadow:false};remotes.set(other.id,rig);parent.position.set(other.x,(other.y??0)+other.jump.height,other.z);
      }
      if(rig.health===0&&other.health>0){rig.fx.reset();rig.parent.position.set(other.x,(other.y??0)+other.jump.height,other.z);}const target=estimates.get(other.id)??other,factor=1-Math.exp(-dt*35);rig.parent.position.x+=(target.x-rig.parent.position.x)*factor;rig.parent.position.z+=(target.z-rig.parent.position.z)*factor;rig.parent.position.y+=((target.y??other.y??0)+other.jump.height-rig.parent.position.y)*factor;rig.parent.rotation.y+=Math.atan2(Math.sin(other.yaw-rig.parent.rotation.y),Math.cos(other.yaw-rig.parent.rotation.y))*factor;rig.model.root.rotation.x=other.stance==='prone'?Math.PI/2:0;rig.model.root.position.y=other.stance==='prone'?.5:0;rig.model.root.scaling.y=other.stance==='crouch'?.6:1;rig.marker.position.y=stanceStats(other.stance).height+.45;rig.marker.material=me.team!==undefined&&me.team===other.team?friendMat:enemyMat;rig.fx.update(dt);rig.parent.setEnabled(other.connected&&other.playing!==false&&(!other.guest||!!other.nickname)&&(other.health>0||rig.fx.showingDeath));rig.health=other.health;
      const shadowRadius=onlineQualityHigh?40:24;
      const castsShadow=!lowPerformance&&requestedShadows&&other.connected&&other.health>0&&other.playing!==false&&Math.hypot(other.x-me.x,other.z-me.z)<shadowRadius;
      if(castsShadow!==rig.castsShadow){for(const mesh of rig.model.meshes){if(castsShadow)shadows.addShadowCaster(mesh);else shadows.removeShadowCaster(mesh);}rig.castsShadow=castsShadow;}
    }
    for(const event of state.events)if(event.id>lastNetworkEvent){lastNetworkEvent=event.id;const from=new Vector3(event.from.x,event.from.y,event.from.z),to=new Vector3(event.to.x,event.to.y,event.to.z);(event.player===id?effects:botEffects).emit(from,to,from.subtract(to).normalize(),true,event.hit);if(event.player===id){recoil.fire(event.weapon);if(event.hit){const rig=event.target?remotes.get(event.target):[...remotes.values()].sort((a,b)=>Vector3.DistanceSquared(a.parent.position,to)-Vector3.DistanceSquared(b.parent.position,to))[0];rig?.fx.hit(to,to.x-rig.parent.position.x,event.killed);}}}
  }
  function practiceState() {
    return {ammo:weapon.ammo,reloadRemaining:weapon.reloadRemaining,magazineSize:spec.magazineSize,weaponId,weaponName:spec.name,reloadSeconds:spec.reloadSeconds,automatic:spec.automatic,cooldown,scoped,
      targetHealth:targets.map(t=>t.health),hits,destroyed,shots,complete:destroyed===targets.length,
      jumpHeight:jumpState.height,grounded:jumpState.height===0&&jumpState.velocity===0&&!falling};
  }
  return {
    geometry,
    get scoped(){return scoped;},
    targetContacts:()=>targets.map((t,i)=>({id:'target-'+i,name:'표적 '+(i+1),x:t.x,z:t.z,y:0,health:t.health})),
    gearState:()=>({gear:{...localActor.gear},health:localActor.health,flash:localActor.flash,healing:localActor.healing,cooldown:localActor.gearCooldown}),
    useEquipment(kind:EquipmentId,p:Point,look:Look){if(preview||reference||battleState().winner)return false;Object.assign(localActor,{stance,jump:jumpState,x:p.x,y:p.y??0,z:p.z,yaw:look.yaw,pitch:look.pitch,health:battleState().playerHealth});const ok=useEquipment(localActor,kind,localProjectiles,++toolSequence);if(ok&&kind!=='medkit')if(camera.position.y-stanceStats(stance).eye-jumpState.height>=3.35&&highShotNotices.length<8)highShotNotices.push('고층 사격 · 내 위치가 4초간 노출됩니다');
    (survivalMode?survival:ffaMode?ffa:duel).playerFired();return ok;},
    setUpgradeTier(tier:number){upgradeTier=Number.isInteger(tier)?Math.max(0,Math.min(3,tier)):0;spec=localSpec(weaponId);},
    doorState:()=>doors,
    move(p:Point,delta:Point){return moveWithCollisions(p,delta,worldSolids(doors),PROTOTYPE.radius,jumpState.height);},
    toggleDoor(p:Point,id:string){const state=battleState(),actors=[p,...state.bots.filter(b=>b.health>0).map(b=>b.position),...(state.mode==='duel'&&state.botHealth>0?[state.position]:[])];const result=toggleDoor(doors,id,p,actors);syncDoors();return result;},
    jump(){if(preview||reference||falling||(battleState().playerHealth===0||!!battleState().winner))return false;const next=beginJump(jumpState);const started=next!==jumpState;jumpState=next;return started;},
    selectWeapon(id:WeaponId){startWeapon=id;weaponId=id;spec=localSpec(id);resetPractice();},
    toggleScope(){if(weaponId!=='sniper'||preview||reference||(battleState().playerHealth===0||!!battleState().winner))return false;scoped=!scoped;return scoped;},
    resetJump(){jumpState=createJump();falling=false;},
    setMode(mode:'practice'|'duel'|'ffa'|'survival',difficulty?:SurvivalDifficulty){if(isSurvivalDifficulty(difficulty))botDifficulty=difficulty;if(mode!=='survival'&&botDifficulty==='auto')botDifficulty='normal';ffaMode=mode==='ffa';survivalMode=mode==='survival';duelMode=mode!=='practice';resetPractice();},
    consumeSounds(){return soundEvents.splice(0);},
    consumeAutoShots(){return autoShotResults.splice(0);},
    duelState:()=>({...battleState(),active:duelMode}),
    inventoryState(){syncSlot(inventory,weapon,cooldown);return {inventory,pickups};},
    pickup(p:Point,id:string,replace?:number){if(preview||reference||(battleState().playerHealth===0||!!battleState().winner))return 'unavailable';syncSlot(inventory,weapon,cooldown);const crate=pickups.find(c=>c.id===id);if(crate?.equipmentId)return takeEquipmentPickup(localActor.gear,p,pickups,id)?'added':'unavailable';const result=takePickup(inventory,p,pickups,id,replace);if(result==='added')equip();return result;},
    switchWeapon(slot:number){if(preview||reference||(battleState().playerHealth===0||!!battleState().winner))return false;syncSlot(inventory,weapon,cooldown);if(!switchSlot(inventory,slot))return false;equip();return true;},
    reload,resetPractice,practiceState,
    onlineNameplates(state:MatchState,id:string){const me=state.players.find(p=>p.id===id);if(!me||me.health<=0)return [];const width=engine.getRenderWidth(),height=engine.getRenderHeight(),viewport=camera.viewport.toGlobal(width,height),transform=camera.getViewMatrix().multiply(camera.getProjectionMatrix());return state.players.filter(p=>p.id!==id&&p.connected&&!p.abandoned&&p.playing!==false&&p.health>0&&(!p.guest||!!p.nickname)).flatMap(p=>{const point=new Vector3(p.x,(p.y??0)+p.jump.height+stanceStats(p.stance).height+.4,p.z);if(Vector3.DistanceSquared(camera.position,point)>60*60||!unobstructed(geometry,doors,{x:camera.position.x,y:camera.position.y,z:camera.position.z},{x:p.x,y:(p.y??0)+p.jump.height+1.8,z:p.z}))return [];const v=Vector3.Project(point,Matrix.Identity(),transform,viewport);if(v.z<0||v.z>1||v.x<0||v.x>width||v.y<0||v.y>height)return [];return [{id:p.id,name:playerName(p),x:v.x/width,y:v.y/height,health:p.health,ally:me.team!==undefined&&me.team===p.team}];});},
    renderOnline,endOnline,
    effectsState:effects.stats,
    impactState:()=>({...robotImpact.stats(),recoil:recoil.read()}),
    setReducedShots(value:boolean){reducedShots=value;effects.setReduced(value);botEffects.setReduced(value||lowPerformance);},
    setShake(level:ShakeLevel){recoil.setShake(level);},
    setShadows(enabled:boolean){requestedShadows=enabled;scene.shadowsEnabled=enabled&&!lowPerformance;},
    setPerformanceLow(enabled:boolean){if(lowPerformance===enabled)return;lowPerformance=enabled;scene.shadowsEnabled=requestedShadows&&!enabled;botEffects.setReduced(reducedShots||enabled);atmosphere.setLow(enabled);mapArt?.setPerformanceLow(enabled);applySurfaceQuality();},
    setQuality(high:boolean){
      onlineQualityHigh=high;for(const r of remotes.values())r.fx.setQuality(high);atmosphere.setQuality(high);robotImpact.setQuality(high);for(const rig of botRigs.slice(1))rig.fx.setQuality(high);
      if(mapArt){
        sky.intensity=high?1.13:.65;
        moon.intensity=high?.47:.32;
        skyMat.fogEnabled=!high;
        for(const lamp of streetLights)lamp.intensity=high?3.4:2.2;
      }
      const mapSize=high?2048:1024;if(shadows.mapSize!==mapSize)shadows.mapSize=mapSize;
      applySurfaceQuality();
      return mapArt?.setQuality(high);
    },
    consumeHighShots(){return highShotNotices.splice(0);},isBotRevealed(id:string){return botReveals.has(id);},setStance(value:Stance){stance=value;},scene, camera, player, update, resize, selectCharacter, setPreview, setReference, shoot,
    setLobbyWeapon(id:WeaponId){lobbyWeaponId=id;lobbyWeapons.show(id,preview&&lobbyPreview);},setLobbyMotion(enabled:boolean){lobbyMotion=enabled;},rotateLobby(delta:number){if(preview&&lobbyPreview&&Number.isFinite(delta))lobbyYaw=Math.atan2(Math.sin(lobbyYaw+delta),Math.cos(lobbyYaw+delta));},resetLobbyRotation(){lobbyYaw=0;},
    get characterType() { return character.type; },
  };
}
