import type {Scene} from '@babylonjs/core/scene.js';
import type {AssetContainer} from '@babylonjs/core/assetContainer.js';
import type {AbstractMesh} from '@babylonjs/core/Meshes/abstractMesh.js';
import {Color3} from '@babylonjs/core/Maths/math.color.js';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder.js';
import {Mesh} from '@babylonjs/core/Meshes/mesh.js';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial.js';
import type {ExpansionQuality} from './expansion-map-art.ts';
import {animalPose,wildlifeSpawns,type Animal} from './wildlife.ts';
import type {Point} from './world.ts';

type Model = typeof wildlifeSpawns[number]['model'];
type ModelAsset = {container: AssetContainer; root: AbstractMesh};

export function createWildlifeArt(scene: Scene) {
  const material = new StandardMaterial('wildlife-meat',scene);
  material.diffuseColor = Color3.FromHexString('#bd5543');
  material.emissiveColor = Color3.FromHexString('#532217');
  const assets = new Map<string,ModelAsset>();
  const pending = new Set<string>();
  const retryAt = new Map<string,number>();
  const fallbackAssets = new Map<Model,Mesh>();
  function fallbackBody(index:number){
    const {model,width:w,height:h,length:l}=wildlifeSpawns[index]!;
    let base=fallbackAssets.get(model);
    if(!base){
      function part(x:number,y:number,z:number,width:number,height:number,depth:number){
        const mesh=MeshBuilder.CreateBox(model+'-part',{width,height,depth},scene);
        mesh.position.set(x,y,z);
        return mesh;
      }
      const parts=[
        part(0,h*.49,-l*.06,w,h*.36,l*.6),
        part(0,h*.68,l*.29,w*.68,h*.29,l*.28),
        part(0,h*.61,l*.46,w*.45,h*.14,l*.16),
        ...[-1,1].flatMap(side=>[
          part(w*.34*side,h*.21,-l*.23,w*.25,h*.42,l*.13),
          part(w*.34*side,h*.21,l*.14,w*.25,h*.42,l*.13),
          part(w*.24*side,h*.85,l*.26,w*.19,h*.25,l*.08),
        ]),
      ];
      if(model==='arctic-fox')parts.push(part(0,h*.44,-l*.47,w*.46,h*.23,l*.32));
      base=Mesh.MergeMeshes(parts,true)!;
      const coat=new StandardMaterial(model+'-fallback-coat',scene);
      coat.diffuseColor=Color3.FromHexString(model==='reindeer'?'#997b65':model==='polar-bear'?'#e0d7bd':'#c4dce8');
      coat.emissiveColor=coat.diffuseColor.scale(.22);
      base.material=coat;
      base.isPickable=false;
      base.setEnabled(false);
      fallbackAssets.set(model,base);
    }
    return base.clone('wildlife-fallback-'+index,null,true)!;
  }
  const rigs = wildlifeSpawns.map(({model},index)=>{
    const meat = MeshBuilder.CreateSphere(model+'-meat-'+index,{diameter:.55,segments:4},scene);
    meat.scaling.set(1,.55,.75);
    meat.material = material;
    meat.isPickable = false;
    meat.setEnabled(false);
    return {model,meat,clones:new Map<ExpansionQuality,AbstractMesh>(),fallback:undefined as Mesh|undefined,active:undefined as AbstractMesh|undefined};
  });
  let visible = false;
  async function load(model: Model,quality: ExpansionQuality,key: string) {
    pending.add(key);
    try {
      const [loader] = await Promise.all([
        import('@babylonjs/core/Loading/sceneLoader.js'),
        import('@babylonjs/loaders/glTF/2.0/glTFLoader.js'),
      ]);
      if (scene.isDisposed) return;
      const container = await loader.LoadAssetContainerAsync('/wildlife/'+model+'-'+quality+'.glb',scene,{pluginExtension:'.glb'});
      if (scene.isDisposed) { container.dispose(); return; }
      const root = container.meshes[0];
      if(!root||!container.meshes.some(mesh=>mesh.getTotalVertices()>0&&mesh.isVisible&&mesh.visibility>0)){
        container.dispose();
        retryAt.set(key,performance.now()+10000);
        return;
      }
      root.setEnabled(false);
      for (const mesh of container.meshes) mesh.isPickable = false;
      for (const mat of container.materials) {
        if ('maxSimultaneousLights' in mat) mat.maxSimultaneousLights = 2;
      }
      container.addAllToScene();
      assets.set(key,{container,root});
    } catch {
      retryAt.set(key,performance.now()+10000);
    } finally {
      pending.delete(key);
    }
  }
  scene.onDisposeObservable.addOnce(()=>{
    for(const rig of rigs)for(const clone of rig.clones.values())clone.dispose();
    for(const {container} of assets.values())container.dispose();
  });
  return (animals: Animal[] | undefined,time: number,viewer: Point,quality: ExpansionQuality,visibility: number)=>{
    if (!animals && !visible) return;
    visible = !!animals;
    for (const [index,rig] of rigs.entries()) {
      const animal = animals?.[index];
      const pose = animalPose(index,time,animal);
      const distance = Math.hypot(pose.x-viewer.x,pose.z-viewer.z);
      const draw = !!animal && animal.health>0 && distance<Math.min(visibility+2,72);
      const detail = distance>34 ? 'low' : distance>19 && quality==='high' ? 'medium' : quality;
      let active: AbstractMesh|undefined;
      if(draw){
        active=rig.clones.get(detail);
        if(!active){
          const key=rig.model+'-'+detail;
          const asset=assets.get(key);
          if(asset){
            active=asset.root.clone(key+'-'+index,null,false)??undefined;
            if(active){
              active.rotationQuaternion=null;
              rig.clones.set(detail,active);
            }
          }else if(!pending.has(key)&&performance.now()>=(retryAt.get(key)??0))void load(rig.model,detail,key);
        }
        active??=rig.clones.values().next().value;
        active??=rig.fallback??=fallbackBody(index);
      }
      if(active!==rig.active){
        rig.active?.setEnabled(false);
        active?.setEnabled(true);
        rig.active=active;
      }
      if(active){
        const stride=Math.min(1,pose.speed/8),gait=time*(15+(index%3)*1.2)+index;
        active.position.set(pose.x,Math.sin(gait)**2*.072*stride,pose.z);
        active.rotation.x=Math.sin(gait*2)*.022*stride;
        active.rotation.y=pose.yaw;
        active.rotation.z=Math.cos(gait)*.027*stride;
      }
      const meat = animal?.meat;
      rig.meat.setEnabled(!!meat && Math.hypot(meat.x-viewer.x,meat.z-viewer.z)<Math.min(visibility+2,36));
      if (meat) rig.meat.position.set(meat.x,.16,meat.z);
    }
  };
}
