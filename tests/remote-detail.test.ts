import test from 'node:test';import assert from 'node:assert/strict';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';import {Scene} from '@babylonjs/core/scene.js';import {TransformNode} from '@babylonjs/core/Meshes/transformNode.js';
import {createCharacter} from '../src/characters.ts';
test('twenty-player remote detail keeps recognizable parts while reducing vertex load',()=>{
 const e=new NullEngine(),s=new Scene(e);try{for(const type of ['robot','robot-cat','welder'] as const){const full=createCharacter(s,new TransformNode('full',s),type),remote=createCharacter(s,new TransformNode('remote',s),type,{detail:'remote'});const vertices=(m:typeof full)=>m.meshes.reduce((n,x)=>n+x.getTotalVertices(),0);assert.ok(vertices(remote)<vertices(full)*.35,'remote model needs less than 35% of original vertices');assert.deepEqual(remote.meshes.map(m=>m.name),full.meshes.map(m=>m.name));assert.equal(remote.type,type);full.root.dispose();remote.root.dispose();}}finally{s.dispose();e.dispose();}
});
