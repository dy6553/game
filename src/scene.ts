import { createRecoil,type ShakeLevel } from './impact.ts';
import { createRobotImpact } from './robot-impact.ts';
import { WEAPONS,pelletOffsets,type WeaponId } from './weapons.ts';
import { createDuel } from './duel.ts';
import type { Engine } from '@babylonjs/core/Engines/engine.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector.js';
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
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { PRACTICE_RULES,createWeapon,tryFire,beginReload,advanceWeapon,applyDamage } from './combat.ts';
import { createJump,beginJump,advanceJump } from './jump.ts';
import { BUILDINGS, COVERS,buildingWalls,interiorFurniture,indoorAt,DOOR_WIDTH } from './world.ts';
import type { Point } from './world.ts';
import { createCharacter } from './characters.ts';
import type { CharacterType } from './characters.ts';

export function createHarborScene(engine: Engine) {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.035, 0.065, 0.115, 1);
  scene.imageProcessingConfiguration.toneMappingEnabled=true;
  scene.imageProcessingConfiguration.toneMappingType=1;
  scene.imageProcessingConfiguration.exposure=1.12;
  scene.imageProcessingConfiguration.contrast=1.08;
  scene.ambientColor = new Color3(0.12, 0.105, 0.12);
  scene.fogMode=Scene.FOGMODE_EXP2;scene.fogDensity=0.004;scene.fogColor=new Color3(0.07,0.095,0.155);
  const camera = new FreeCamera('camera', new Vector3(36, 55, -36), scene);
  camera.mode = FreeCamera.PERSPECTIVE_CAMERA;
  camera.fov = 1.25;
  camera.minZ = 0.06; camera.maxZ = 500;
  const sky = new HemisphericLight('sky', new Vector3(0, 1, 0), scene);
  sky.intensity = 0.34; sky.diffuse = Color3.FromHexString('#b4b9cb');
  sky.groundColor = Color3.FromHexString('#243446');
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
  for (const building of BUILDINGS) {
    const { id, x, z, width, depth, height, palette } = building;
    const meshes: Mesh[] = [];
    const part = (name: string, px: number, py: number, pz: number, w: number, h: number, d: number, mat: StandardMaterial) => {
      const mesh = box(`${id}-${name}`, px, py, pz, w, h, d, mat);
      meshes.push(mesh); return mesh;
    };
    const body = part('body', x, building.enterable?(height+3.4)/2:height/2, z, width,building.enterable?height-3.4:height,depth,bodyMaterials[palette]!);
    if(building.enterable){
      for(const wall of buildingWalls(building))part('shell-'+wall.id,wall.x,1.7,wall.z,wall.width,3.4,wall.depth,bodyMaterials[palette]!);
      part('interior-floor',x,.035,z,width-.45,.06,depth-.45,interiorFloor);
      part('ceiling',x,3.35,z,width-.4,.1,depth-.4,wood);
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
      for(let i=0;i<4;i++){
        const shelfZ=z-3+i*1.4;part('interior-shelf',x-width/2+.55,1.5,shelfZ,.45,.08,1.15,wood);
        for(let j=0;j<4;j++)part('books',x-width/2+.55,1.72,shelfZ-.4+j*.23,.25,.35+(j%2)*.1,.16,awningMats[(i+j)%3]!);
      }
    }
    body.receiveShadows = true; shadows.addShadowCaster(body);
    if(!building.enterable)part('foundation', x, 0.3, z, width + 0.3, 0.6, depth + 0.3, metal);
    part('cornice', x, height - 0.1, z, width + 0.5, 0.25, depth + 0.5, stone);
    for (const side of [-1,1]) {
      const roof = part('roof', x, height+0.65, z+side*depth/4, width+0.85,0.22,depth/2+0.8,roofMat);
      roof.rotation.x=side*0.18;shadows.addShadowCaster(roof);
      part('gutter',x,height+0.1,z+side*(depth/2+0.5),width+1,0.15,0.14,metal);
    }
    part('roof-ridge',x,height+1.28,z,width+1,0.18,0.28,metal);
    const front = z < 0 ? 1 : -1;
    const frontZ = z + front * (depth / 2 + 0.06);
    for (let floor = 2; floor < height - 0.8; floor += 2.4) {
      for (let offset = -width / 2 + 1.3; offset < width / 2 - 0.5; offset += 2.5) {
        if(building.enterable&&floor<3.4&&Math.abs(offset)<2.4)continue;
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
    if (cover.id === 'van') {
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
  for(const [treeIndex,cover] of COVERS.filter(c=>c.id!=='van').entries()) {
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
    character.root.dispose();
    character = createCharacter(scene, player, type);
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
  addStreetDetails(scene);
  const buildingParts = new Set(occluders.flatMap(building => building.meshes));
  const staticMeshes=batch(scene.meshes.filter((mesh): mesh is Mesh => mesh instanceof Mesh
    && !mesh.parent && !buildingParts.has(mesh) && mesh.material !== poolMat && mesh !== skyDome));
  for(const mesh of staticMeshes)mesh.freezeWorldMatrix();
  for(const mesh of staticMeshes) if(mesh.material===canopyMat || mesh.material===wood) shadows.addShadowCaster(mesh);
  for (const mesh of scene.meshes) {
    if (mesh instanceof Mesh && !mesh.parent && mesh.material !== poolMat && mesh !== skyDome) mesh.isPickable = true;
  }
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
    return { mat: targetMat, flash: 0,root,healthBar,x:p.x,health:PRACTICE_RULES.maxHealth };

  });
  const atmosphere=createAtmosphere(scene);
  let duel=createDuel(), duelMode=false;
  const botParent=new TransformNode('opponent',scene);
  const opponent=createCharacter(scene,botParent,'robot-cat');
  for(const mesh of opponent.meshes){mesh.isPickable=true;mesh.metadata={opponent:true};shadows.addShadowCaster(mesh);}
  const opponentMark=box('opponent-marker',0,2.6,0,0.7,0.08,0.08,material('opponent-red','#ff856d','#f74f2d'));
  opponentMark.parent=botParent;opponentMark.isPickable=false;
  const botGun=box('opponent-pistol',0.32,1.65,0.65,0.14,0.16,0.5,metal);
  botGun.parent=opponent.root;botGun.isPickable=true;botGun.metadata={opponent:true};
  const opponentBody=[...opponent.meshes,botGun];
  const robotImpact=createRobotImpact(scene,opponent.root,opponentBody);
  botParent.setEnabled(false);
  const botEffects=createShotEffects(scene,camera);
  const warningMat=material('incoming-warning','#ff9d59','#ff5935');warningMat.alpha=0.65;
  const warningRing=MeshBuilder.CreateTorus('incoming-shot-ring',{diameter:1.3,thickness:0.055,tessellation:32},scene);
  warningRing.material=warningMat;warningRing.isPickable=false;warningRing.setEnabled(false);
  const soundEvents:{kind:'pistol';x:number;z:number}[]=[];
  let seenRespawn=0;
  function syncBot(){
    const state=duel.state();
    warningRing.setEnabled(duelMode&&!!state.locked&&!preview&&!reference);
    if(state.locked){warningRing.position.set(state.locked.x,0.07,state.locked.z);warningRing.scaling.setAll(1+state.warning);}
    opponentMark.scaling.y=state.locked?2.5:1;
    const alive=state.botHealth>0;
    for(const mesh of opponentBody)mesh.isPickable=alive;
    opponentMark.setEnabled(alive);
    botParent.setEnabled(duelMode&&(alive||robotImpact.showingDeath)&&!preview&&!reference);
    botParent.position.set(state.position.x,0,state.position.z);
    botParent.rotation.y=Math.atan2(camera.position.x-state.position.x,camera.position.z-state.position.z);
    opponentMark.scaling.x=Math.max(0.001,state.botHealth/100);
    botParent.computeWorldMatrix(true);
  }
  let weaponId:WeaponId='pistol',spec=WEAPONS.pistol,cooldown=0,scoped=false;
  let weapon=createWeapon(spec);
  let jumpState=createJump();
  let hits=0,destroyed=0,shots=0;
  const effects=createShotEffects(scene,camera);
  let preview = false, reference = false;
  const recoil=createRecoil();
  let animationTime = 0;
  function resize() { camera.getProjectionMatrix(true); }
  function setReference(value: boolean) {
    effects.clear();botEffects.clear();robotImpact.clearParticles();recoil.clear();reference=value;player.setEnabled(value);plinth.setEnabled(false);viewModel.setEnabled(!value);
    camera.fov=value?0.95:1.25;camera.getProjectionMatrix(true);
  }
  function setPreview(value: boolean) {
    effects.clear();botEffects.clear();robotImpact.clearParticles();recoil.clear();reference=false;preview = value;plinth.setEnabled(value); player.setEnabled(value); viewModel.setEnabled(!value);
    camera.fov=value?0.85:1.25;camera.getProjectionMatrix(true);
    previewLight.setEnabled(value);
    for(const light of streetLights) light.setEnabled(!value);
  }
  function update(p: Point, dt: number, look: Look = { yaw: 0, pitch: 0 }, paused=false) {
    if(!preview&&!reference&&!paused){weapon=advanceWeapon(weapon,dt,spec);cooldown=Math.max(0,cooldown-dt);jumpState=advanceJump(jumpState,dt);}
    if(!paused)atmosphere.update(dt,p);
    const texel=64/shadows.mapSize;
    moon.position.set(Math.round((p.x+24.75)/texel)*texel,55,Math.round((p.z-13.75)/texel)*texel);
    waterNormals.uOffset+=paused?0:Math.min(dt,.1)*.012;
    const active=!paused&&!preview&&!reference;
    if(active){animationTime+=dt;recoil.update(dt);robotImpact.update(dt);}
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
      const wasBotDead=duel.state().botHealth===0;
      duel.update(dt,p,point=>{
        const from=new Vector3(point.x,1.8,point.z),to=new Vector3(p.x,1.95+jumpState.height,p.z);
        const direction=to.subtract(from),distance=direction.length();
        const obstruction=scene.pickWithRay(new Ray(from,direction.scale(1/distance),Math.max(0,distance-0.25)),mesh=>mesh.isPickable&&mesh.isEnabled()&&!mesh.metadata?.opponent);
        return !obstruction?.hit;
      },(point,target)=>{
        const start=new Vector3(point.x,1.8,point.z),end=new Vector3(target.x,1.8,target.z);
        const delta=end.subtract(start),distance=delta.length();
        const wall=scene.pickWithRay(new Ray(start,delta.scale(1/distance),distance),mesh=>mesh.isPickable&&mesh.isEnabled()&&!mesh.metadata?.opponent);
        const impact=wall?.pickedPoint??end;
        if(soundEvents.length<16)soundEvents.push({kind:'pistol',x:point.x,z:point.z});
        botEffects.emit(start,impact,wall?.getNormal(true)??delta.normalize().scale(-1),!!wall?.hit,false);
        return !wall?.hit;
      });
      const state=duel.state();
      if(wasBotDead&&state.botHealth>0)robotImpact.reset();
      if(state.respawnVersion!==seenRespawn){seenRespawn=state.respawnVersion;p.x=0;p.z=-8;weapon=createWeapon(spec);cooldown=0;scoped=false;jumpState=createJump();recoil.clear();}
    }
    player.position.x = p.x; player.position.z = p.z;
    player.position.y=preview||reference?0:jumpState.height;
    player.rotation.y = look.yaw;
    if(reference) {
      camera.position.set(42,50,-60);camera.setTarget(new Vector3(0,0,7));
    } else if (preview) {
      camera.position.set(p.x + 1.7, 2, p.z + 4.3);
      player.rotation.y = Math.sin(animationTime*0.5)*0.12-0.1;
      previewLight.position.set(p.x+1,3.8,p.z+3);
      camera.setTarget(new Vector3(p.x+1.25,1.35,p.z));
    } else {
      camera.position.set(p.x,(character.type==='robot-cat'?1.9:1.95)+jumpState.height,p.z);
      camera.fov=(scoped?.38:1.25)+kick.fov;viewModel.setEnabled(!scoped);
      camera.rotation.set(look.pitch, look.yaw, kick.roll);
    }
    scopeBody.setEnabled(weaponId==='sniper');secondBarrel.setEnabled(weaponId==='shotgun');
    gun.scaling.z=weaponId==='pistol'?1:1.6;barrel.scaling.z=weaponId==='sniper'?2:weaponId==='pistol'?1:1.5;
    const inside=indoorAt(p);for(const item of interiorLights)item.light.setEnabled(!preview&&!reference&&item.id===inside?.id);
    syncBot();
  }
  setPreview(false);
  resize();
  function shoot() {
    if (preview || reference || (duelMode&&(duel.state().playerHealth===0||!!duel.state().winner))) return { fired: false, hit: false };
    if(cooldown>1e-8)return {fired:false,hit:false,reason:'cooldown'};
    const attempt=tryFire(weapon);weapon=attempt.state;
    if(!attempt.fired)return {fired:false,hit:false,reason:attempt.reason};
    shots++;recoil.fire(weaponId);cooldown=spec.interval;
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
    if(hit&&duelMode){const before=duel.state().botHealth;eliminated=duel.hurt('bot',spec.damage);const damage=before-duel.state().botHealth;totalDamage+=damage;if(damage>0)robotImpact.hit(end,end.x-duel.state().position.x,eliminated);syncBot();}
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
    if(preview||reference||(duelMode&&(duel.state().playerHealth===0||!!duel.state().winner)))return false;
    const next=beginReload(weapon,spec);const started=next!==weapon;weapon=next;return started;
  }
  function resetPractice() {
    weapon=createWeapon(spec);cooldown=0;scoped=false;jumpState=createJump();hits=0;destroyed=0;shots=0;
    effects.clear();botEffects.clear();recoil.clear();robotImpact.reset();duel=createDuel();seenRespawn=0;syncBot();
    for(const target of targets){
      target.health=PRACTICE_RULES.maxHealth;target.flash=0;target.root.setEnabled(!duelMode);
      target.healthBar.scaling.x=1;target.healthBar.position.x=target.x;
    }
  }
  function practiceState() {
    return {ammo:weapon.ammo,reloadRemaining:weapon.reloadRemaining,magazineSize:spec.magazineSize,weaponId,weaponName:spec.name,reloadSeconds:spec.reloadSeconds,automatic:spec.automatic,cooldown,scoped,
      targetHealth:targets.map(t=>t.health),hits,destroyed,shots,complete:destroyed===targets.length,
      jumpHeight:jumpState.height,grounded:jumpState.height===0&&jumpState.velocity===0};
  }
  return {
    jump(){if(preview||reference||(duelMode&&(duel.state().playerHealth===0||!!duel.state().winner)))return false;const next=beginJump(jumpState);const started=next!==jumpState;jumpState=next;return started;},
    selectWeapon(id:WeaponId){weaponId=id;spec=WEAPONS[id];resetPractice();},
    toggleScope(){if(weaponId!=='sniper'||preview||reference||(duelMode&&(duel.state().playerHealth===0||!!duel.state().winner)))return false;scoped=!scoped;return scoped;},
    resetJump(){jumpState=createJump();},
    setMode(mode:'practice'|'duel'){duelMode=mode==='duel';resetPractice();},
    consumeSounds(){return soundEvents.splice(0);},
    duelState:()=>({...duel.state(),active:duelMode}),
    reload,resetPractice,practiceState,
    effectsState:effects.stats,
    impactState:()=>({...robotImpact.stats(),recoil:recoil.read()}),
    setShake(level:ShakeLevel){recoil.setShake(level);},
    setQuality(high:boolean){
      atmosphere.setQuality(high);robotImpact.setQuality(high);
      const mapSize=high?2048:1024;if(shadows.mapSize!==mapSize)shadows.mapSize=mapSize;
      for(const texture of scene.textures)texture.anisotropicFilteringLevel=high?8:4;
    },
    scene, camera, player, update, resize, selectCharacter, setPreview, setReference, shoot,
    get characterType() { return character.type; },
  };
}
