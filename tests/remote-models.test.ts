import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {createCharacter} from '../src/characters.ts';
import {createRemoteModels} from '../src/remote-models.ts';
import {createRobotImpact} from '../src/robot-impact.ts';

test('batching retains every vertex, armor color and emissive surface for all three character types',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),factory=createRemoteModels(scene);
 try{for(const type of ['robot','robot-cat','welder'] as const){
  const reference=createCharacter(scene,new TransformNode('reference',scene),type,{detail:'remote'});
  const expected=new Map<string,number>();let vertices=0;
  for(const mesh of reference.meshes){const c=(mesh.material as any).diffuseColor,key=[c.r,c.g,c.b].map(v=>Math.round(v*1000)).join(',');expected.set(key,(expected.get(key)??0)+mesh.getTotalVertices());vertices+=mesh.getTotalVertices();}
  const model=factory.create(new TransformNode('actor',scene),type,true),actual=new Map<string,number>();
  assert.equal(model.meshes.reduce((sum,m)=>sum+m.getTotalVertices(),0),vertices,'no body parts or triangles are removed');
  for(const mesh of model.meshes){const colors=mesh.getVerticesData('color')!;for(let i=0;i<colors.length;i+=4){const key=[colors[i]!,colors[i+1]!,colors[i+2]!].map(v=>Math.round(v*1000)).join(',');actual.set(key,(actual.get(key)??0)+1);assert.equal(colors[i+3],1);}}
  assert.deepEqual(actual,expected,'the full original palette is preserved');
  assert.ok(model.meshes.some(m=>(m.material as any).emissiveColor.r>0),'eyes and lights retain emission');
  model.root.dispose();reference.root.parent!.dispose();
 }}finally{factory.clear();scene.dispose();engine.dispose();}
});

test('shared geometry keeps per-player hit materials independent and templates clean up',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),factory=createRemoteModels(scene);
 try{
  const before=scene.geometries.length,a=factory.create(new TransformNode('a',scene),'robot',true),b=factory.create(new TransformNode('b',scene),'robot',true);
  assert.ok(a.meshes.every((m,i)=>m.geometry===b.meshes[i]!.geometry));
  const hitA=createRobotImpact(scene,a.root,a.meshes,{particleLimit:4}),hitB=createRobotImpact(scene,b.root,b.meshes,{particleLimit:4});
  const emission=(b.meshes[0]!.material as any).emissiveColor.clone();
  hitA.hit(Vector3.Zero(),1,false);hitA.update(.02);
  assert.notDeepEqual((a.meshes[0]!.material as any).emissiveColor.asArray(),emission.asArray());
  assert.deepEqual((b.meshes[0]!.material as any).emissiveColor.asArray(),emission.asArray());
  hitA.dispose();hitB.dispose();a.root.parent!.dispose();b.root.parent!.dispose();factory.clear();
  assert.equal(scene.geometries.length,before,'cached geometries are released after the final actor');
 }finally{factory.clear();scene.dispose();engine.dispose();}
});
