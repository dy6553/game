import type {Scene} from '@babylonjs/core/scene.js';
import type {AssetContainer} from '@babylonjs/core/assetContainer.js';
import type {AbstractMesh} from '@babylonjs/core/Meshes/abstractMesh.js';
import {Color3} from '@babylonjs/core/Maths/math.color.js';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder.js';
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
  const rigs = wildlifeSpawns.map(({model},index)=>{
    const meat = MeshBuilder.CreateSphere(model+'-meat-'+index,{diameter:.55,segments:4},scene);
    meat.scaling.set(1,.55,.75);
    meat.material = material;
    meat.isPickable = false;
    meat.setEnabled(false);
    return {model,meat,clones:new Map<ExpansionQuality,AbstractMesh>(),active:undefined as AbstractMesh|undefined};
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
      const root = container.meshes[0]!;
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
