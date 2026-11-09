import test from 'node:test';import assert from 'node:assert/strict';import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';import {createHarborScene} from '../src/scene.ts';import {createNetworkGame} from '../src/network-game.ts';
test('nineteen remote actors render together and clean up without mesh or material growth',()=>{const e=new NullEngine(),w=createHarborScene(e,{randomSpawns:false});try{const g=createNetworkGame(undefined,'harbor',{mode:'team'});for(let i=0;i<20;i++)g.join('p'+i,'pistol',i%2?'robot-cat':'robot');w.setMode('practice');w.update({x:0,z:-8},0);const before={meshes:w.scene.meshes.length,materials:w.scene.materials.length};for(let cycle=0;cycle<3;cycle++){w.renderOnline(g.state,'p0',{yaw:0,pitch:0},.05);assert.equal(w.scene.transformNodes.filter(n=>n.name.startsWith('online-player-')).length,19);assert.ok(w.scene.meshes.length-before.meshes<600,'merged actors and bounded FX pools');w.endOnline();assert.equal(w.scene.meshes.length,before.meshes);assert.equal(w.scene.materials.length,before.materials);}}finally{w.scene.dispose();e.dispose();}});

test('balanced multiplayer limits distant shadow work while retaining all remote actors',()=>{
 const e=new NullEngine(),w=createHarborScene(e,{randomSpawns:false});try{
  const g=createNetworkGame(undefined,'harbor',{mode:'ffa'});for(let i=0;i<20;i++)g.join('p'+i);
  g.state.players[0]!.x=0;g.state.players[0]!.z=-8;
  g.state.players[1]!.x=0;g.state.players[1]!.z=0;
  for(const p of g.state.players.slice(2)){p.x=60;p.z=30;}
  w.setMode('practice');w.setQuality(false);w.renderOnline(g.state,'p0',{yaw:0,pitch:0},.05);
  const shadow=w.scene.getLightByName('moon')!.getShadowGenerator()!.getShadowMap()!;
  const remoteCasters=()=>shadow.renderList!.filter(m=>m.name.startsWith('remote-body-'));
  assert.ok(remoteCasters().length>0,'nearby actors keep contact shadows');
  assert.ok(remoteCasters().every(m=>m.parent?.parent?.name==='online-player-p1'),'far models must not add shadow-map passes');
  assert.equal(w.scene.transformNodes.filter(n=>n.name.startsWith('online-player-')&&n.isEnabled()).length,19,'distance does not remove opponents');
  w.setPerformanceLow(true);w.renderOnline(g.state,'p0',{yaw:0,pitch:0},.05);
  assert.equal(remoteCasters().length,0,'low profile removes remote shadow casters');
  w.setPerformanceLow(false);w.renderOnline(g.state,'p0',{yaw:0,pitch:0},.05);
  assert.ok(remoteCasters().length>0,'returning to balanced restores nearby shadows');
 }finally{w.scene.dispose();e.dispose();}
});
