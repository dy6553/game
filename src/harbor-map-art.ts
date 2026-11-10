import type {AssetContainer} from '@babylonjs/core/assetContainer.js';
import type {Scene} from '@babylonjs/core/scene.js';
import type {ShadowGenerator} from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import {Material} from '@babylonjs/core/Materials/material.js';
import type {AbstractMesh} from '@babylonjs/core/Meshes/abstractMesh.js';
import {Mesh} from '@babylonjs/core/Meshes/mesh.js';
import type {TransformNode} from '@babylonjs/core/Meshes/transformNode.js';
import type {Building, Doors} from './world.ts';

export type HarborArtSource = () => string | ArrayBufferView;
let loader: Promise<typeof import('@babylonjs/core/Loading/sceneLoader.js')> | undefined;

async function load(scene: Scene, source: ReturnType<HarborArtSource>) {
  loader ??= Promise.all([
    import('@babylonjs/core/Loading/sceneLoader.js'),
    import('@babylonjs/loaders/glTF/2.0/glTFLoader.js'),
  ]).then(([sceneLoader]) => sceneLoader);
  return (await loader).LoadAssetContainerAsync(source, scene, {pluginExtension: '.glb'});
}

export function createHarborMapArt(
  scene: Scene, source: HarborArtSource, legacy: AbstractMesh[],
  buildings: readonly Building[], doorState: () => Doors, shadows: ShadowGenerator,
) {
  const visibility = legacy.map(mesh => mesh.visibility);
  const originalCasters = (shadows.getShadowMap()?.renderList ?? []).filter(mesh => legacy.includes(mesh));
  let requested: boolean | undefined;
  let generation = 0;
  let performanceLow = false;
  let active: {container: AssetContainer; doors: [Building, TransformNode][]} | undefined;

  function removeArt() {
    if (!active) return;
    active.container.removeAllFromScene();
    active.container.dispose();
    active = undefined;
  }

  function syncDoors() {
    if (!active) return;
    const states = doorState();
    for (const [building, node] of active.doors) {
      node.rotation.y = states[building.id] ? (building.z < 0 ? 1 : -1) * Math.PI / 2 : 0;
    }
  }

  function applyPerformance() {
    if (!active) return;
    for (const material of active.container.materials) {
      if ('unlit' in material) material.unlit = performanceLow;
    }
    for (const mesh of active.container.meshes) mesh.receiveShadows = !performanceLow;
  }

  async function setQuality(high: boolean) {
    if (requested === high || scene.isDisposed) return;
    requested = high;
    const ticket = ++generation;
    if (high) {
      if (active) {
        removeArt();
        legacy.forEach((mesh, index) => { mesh.visibility = visibility[index]!; });
        for (const mesh of originalCasters) shadows.addShadowCaster(mesh, false);
      }
      return;
    }
    let next: AssetContainer | undefined;
    try {
      next = await load(scene, source());
      if (ticket !== generation || scene.isDisposed) return;
      const root = next.meshes.find(mesh => mesh.name === '__root__');
      if (!root) throw new Error('Harbor art root is missing');
      root.name = 'harbor-art-low';
      // The Blender export already writes the numeric game coordinates into glTF.
      // Bypass the loader's handedness transform and keep the exported face winding.
      root.rotationQuaternion = null;
      root.rotation.setAll(0);
      root.scaling.setAll(1);
      const nodes = [...next.meshes, ...next.transformNodes];
      const doors: [Building, TransformNode][] = buildings.filter(b => b.enterable).map(building => {
        const node = nodes.find(node => node.name === building.id + '-interactive-door');
        if (!node) throw new Error('Harbor art door is missing: ' + building.id);
        node.rotationQuaternion = null;
        return [building, node];
      });
      for (const mesh of next.meshes) {
        mesh.isPickable = false;
        mesh.checkCollisions = false;
        if (mesh instanceof Mesh) mesh.sideOrientation = Material.CounterClockWiseSideOrientation;
      }
      next.addAllToScene();
      active = {container: next, doors};
      next = undefined;
      for (const mesh of originalCasters) shadows.removeShadowCaster(mesh, false);
      // Ray picking supplies a predicate, so the original meshes stay available for shots.
      for (const mesh of legacy) mesh.visibility = 0;
      applyPerformance();
      syncDoors();
    } catch (error) {
      if (ticket === generation && !scene.isDisposed) {
        console.warn('항구 맵 모델을 불러오지 못했습니다.', error);
      }
    } finally {
      next?.dispose();
    }
  }

  scene.onDisposeObservable.addOnce(() => { ++generation; removeArt(); });
  return {setQuality, syncDoors, setPerformanceLow(value: boolean) {
    performanceLow = value;
    applyPerformance();
  }};
}
