import {Mesh} from '@babylonjs/core/Meshes/mesh.js';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode.js';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial.js';
import {Color3} from '@babylonjs/core/Maths/math.color.js';
import type {Scene} from '@babylonjs/core/scene.js';
import {createCharacter,type CharacterType} from './characters.ts';

export type RemoteModel={root:TransformNode;meshes:Mesh[];type:CharacterType};
// Bake the existing armor colors into vertices; preserve separate emissive colors.
// Templates share geometry, while each actor's impact materials stay private.
export function createRemoteModels(scene:Scene){
 const surfaces=new Map<string,StandardMaterial>();
 const surface=(emission:Color3)=>{
  const key=emission.toHexString();let material=surfaces.get(key);
  if(!material){
   material=new StandardMaterial('remote-surface-'+key,scene);
   material.diffuseColor=Color3.White();material.emissiveColor=emission.clone();
   material.specularColor.set(.4,.44,.48);material.specularPower=64;
   surfaces.set(key,material);
  }
  return material;
 };
 for(const color of [Color3.Black(),Color3.FromHexString('#65e9ef').scale(.85),Color3.FromHexString('#ffbe5e').scale(.85)])surface(color);
 const templates=new Map<string,{container:TransformNode;meshes:Mesh[]}>();
 function template(type:CharacterType,twoHanded:boolean){
  const key=type+':'+twoHanded;const cached=templates.get(key);if(cached)return cached;
  const container=new TransformNode('remote-template-'+key,scene);
  const oldMaterials=new Set(scene.materials),model=createCharacter(scene,container,type,{detail:'remote'});
  const temporaryMaterials=scene.materials.filter(m=>!oldMaterials.has(m));
  model.poseLobby(true,0,twoHanded);model.root.computeWorldMatrix(true);
  const groups=new Map<StandardMaterial,Mesh[]>();
  for(const mesh of model.meshes){
   mesh.computeWorldMatrix(true);const original=mesh.material as StandardMaterial;
   const colors=new Float32Array(mesh.getTotalVertices()*4),c=original.diffuseColor;
   for(let i=0;i<colors.length;i+=4){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;colors[i+3]=1;}
   mesh.setVerticesData('color',colors);mesh.hasVertexAlpha=false;
   const material=surface(original.emissiveColor),group=groups.get(material)??[];group.push(mesh);groups.set(material,group);
  }
  const meshes:Mesh[]=[];
  for(const [material,group] of groups){
   const mesh=Mesh.MergeMeshes(group,true,true);if(!mesh)throw Error('Unable to merge remote character');
   mesh.name='remote-template-surface';mesh.parent=model.root;mesh.material=material;mesh.isPickable=false;meshes.push(mesh);
  }
  for(const material of temporaryMaterials)material.dispose();
  container.setEnabled(false);const result={container,meshes};templates.set(key,result);return result;
 }
 return {
  create(parent:TransformNode,type:CharacterType,twoHanded:boolean):RemoteModel{
   const source=template(type,twoHanded),root=new TransformNode('character-'+type,scene);root.parent=parent;
   const meshes=source.meshes.map((mesh,index)=>{const copy=mesh.clone('remote-body-'+index,root)!;copy.isPickable=false;return copy;});
   return {root,meshes,type};
  },
  clear(){for(const t of templates.values())t.container.dispose();templates.clear();},
 };
}
