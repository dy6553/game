import type {Scene} from '@babylonjs/core/scene.js';
import type {AssetContainer} from '@babylonjs/core/assetContainer.js';
import {Color3} from '@babylonjs/core/Maths/math.color.js';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder.js';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial.js';
import type {ExpansionQuality} from './expansion-map-art.ts';
import {animalPose,wildlifeSpecies,type Animal} from './wildlife.ts';
import type {Point} from './world.ts';

export function createWildlifeArt(scene: Scene) {
  const material = new StandardMaterial('wildlife-meat',scene);
  material.diffuseColor = Color3.FromHexString('#bd5543');
  material.emissiveColor = Color3.FromHexString('#532217');
  const rigs = wildlifeSpecies.map(({model})=>{
    const meat = MeshBuilder.CreateSphere(model+'-meat',{diameter:.55,segments:4},scene);
    meat.scaling.set(1,.55,.75);
    meat.material = material;
    meat.isPickable = false;
    meat.setEnabled(false);
    return {model,meat,cache:new Map<ExpansionQuality,AssetContainer>(),pending:new Set<ExpansionQuality>(),retryAt:0};
  });
  let visible = false;
  async function load(rig: typeof rigs[number], quality: ExpansionQuality) {
    rig.pending.add(quality);
    try {
      const [loader] = await Promise.all([
        import('@babylonjs/core/Loading/sceneLoader.js'),
        import('@babylonjs/loaders/glTF/2.0/glTFLoader.js'),
      ]);
      if (scene.isDisposed) return;
      const container = await loader.LoadAssetContainerAsync('/wildlife/'+rig.model+'-'+quality+'.glb',scene,{pluginExtension:'.glb'});
      if (scene.isDisposed) { container.dispose(); return; }
      const root = container.meshes[0]!;
      root.setEnabled(false);
      for (const mesh of container.meshes) mesh.isPickable = false;
      for (const mat of container.materials) {
        if ('maxSimultaneousLights' in mat) mat.maxSimultaneousLights = 2;
      }
      container.addAllToScene();
      rig.cache.set(quality,container);
    } catch {
      rig.retryAt = performance.now()+10000;
    } finally {
      rig.pending.delete(quality);
    }
  }
  scene.onDisposeObservable.addOnce(()=>{
    for (const rig of rigs) for (const container of rig.cache.values()) container.dispose();
  });
  return (animals: Animal[] | undefined,time: number,viewer: Point,quality: ExpansionQuality,visibility: number)=>{
    if (!animals && !visible) return;
    visible = !!animals;
    for (const [index,rig] of rigs.entries()) {
      const animal = animals?.[index];
      const pose = animalPose(index,time);
      const distance = Math.hypot(pose.x-viewer.x,pose.z-viewer.z);
      const draw = !!animal && animal.health>0 && distance<Math.min(visibility+2,72);
      const detail = distance>34 ? 'low' : distance>19 && quality==='high' ? 'medium' : quality;
      if (draw && !rig.cache.has(detail) && !rig.pending.has(detail) && performance.now()>=rig.retryAt) void load(rig,detail);
      const active = draw ? rig.cache.get(detail) ?? rig.cache.values().next().value : undefined;
      for (const container of rig.cache.values()) container.meshes[0]!.setEnabled(container===active);
      if (active) {
        const root = active.meshes[0]!;
        root.position.set(pose.x,0,pose.z);
        root.rotationQuaternion = null;
        root.rotation.y = pose.yaw;
      }
      const meat = animal?.meat;
      rig.meat.setEnabled(!!meat && Math.hypot(meat.x-viewer.x,meat.z-viewer.z)<Math.min(visibility+2,36));
      if (meat) rig.meat.position.set(meat.x,.16,meat.z);
    }
  };
}
