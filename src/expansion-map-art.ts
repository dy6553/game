import type {Scene} from '@babylonjs/core/scene.js';
import type {AssetContainer} from '@babylonjs/core/assetContainer.js';
import type {AbstractMesh} from '@babylonjs/core/Meshes/abstractMesh.js';
import type {ShadowGenerator} from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import type {ExpansionMapId} from './maps.ts';

export type ExpansionQuality='low'|'medium'|'high';
export type ExpansionArtSource=(map:ExpansionMapId,quality:ExpansionQuality)=>string|ArrayBufferView;
let loader:Promise<typeof import('@babylonjs/core/Loading/sceneLoader.js')>|undefined;
export function createExpansionMapArt(scene:Scene,map:ExpansionMapId,fallback:AbstractMesh[],source:ExpansionArtSource=(id,q)=>`/maps/${id}-${q}.glb`,shadows?:ShadowGenerator){
 let high=false,low=false,generation=0,requested:ExpansionQuality|undefined;
 let active:AssetContainer|undefined;
 function release(){if(active){for(const mesh of active.meshes)shadows?.removeShadowCaster(mesh,false);active.dispose();active=undefined;}}
 async function update(){
  const quality=high?'high':low?'low':'medium';
  if(requested===quality||scene.isDisposed)return;
  requested=quality;const ticket=++generation;let next:AssetContainer|undefined;
  try{
   loader??=Promise.all([import('@babylonjs/core/Loading/sceneLoader.js'),import('@babylonjs/loaders/glTF/2.0/glTFLoader.js')]).then(([l])=>l);
   next=await (await loader).LoadAssetContainerAsync(source(map,quality),scene,{pluginExtension:'.glb'});
   if(scene.isDisposed||ticket!==generation)return;
   const root=next.meshes.find(m=>m.name==='__root__');
   if(!root)throw Error('Map root is missing');
   // Keep the loader's standard handedness conversion: readable text, correct winding.
   // Shared geometry mirrors X when extracted from Blender metadata to match it.
   root.name=`${map}-art-${quality}`;
   for(const mesh of next.meshes){
    mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=true;
   }
   for(const mat of next.materials){
    if('maxSimultaneousLights' in mat)mat.maxSimultaneousLights=quality==='high'?4:quality==='medium'?3:2;
    for(const texture of mat.getActiveTextures())texture.anisotropicFilteringLevel=quality==='high'?8:quality==='medium'?4:2;
   }
   release();next.addAllToScene();active=next;next=undefined;
   for(const mesh of active.meshes){
    mesh.computeWorldMatrix(true);
    // Static Blender batches are immutable; leave prop hierarchies available to gameplay.
    if(mesh.name.startsWith('Batched'))mesh.freezeWorldMatrix();
    const box=mesh.getBoundingInfo().boundingBox;
    if(quality!=='low'&&box.extendSizeWorld.y>.2&&box.extendSizeWorld.x<35&&box.extendSizeWorld.z<35&&box.minimumWorld.y<20)shadows?.addShadowCaster(mesh,false);
   }
   // Shared collider meshes remain ray-pickable even when their fallback art is hidden.
   fallback.forEach(m=>m.visibility=0);
  }catch(error){
   if(ticket===generation&&!scene.isDisposed){requested=undefined;console.warn('새 전장 모델을 불러오지 못했습니다.',error);}
  }finally{next?.dispose();}
 }
 scene.onDisposeObservable.addOnce(()=>{generation++;release();});
 return {setQuality(value:boolean){high=value;return update();},setPerformanceLow(value:boolean){low=value;return update();},syncDoors(){}};
}
