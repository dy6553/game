import test from 'node:test';
import assert from 'node:assert/strict';
import {BUILDINGS,COVERS,PROTOTYPE,worldSolids,canStand,doorRect} from '../src/world.ts';
import {findRoute} from '../src/duel.ts';
import {createNetworkGame} from '../src/network-game.ts';
test('six new standing-height covers protect open lanes without sealing entrances',()=>{
 const added=COVERS.filter(c=>c.id.startsWith('combat-'));assert.equal(added.length,6,'six extra tactical covers are required');
 for(const cover of added){assert.equal(canStand(cover,PROTOTYPE.radius,worldSolids()),false);const solid=worldSolids().find(c=>c.id===cover.id)!;assert.ok((solid.yMax??0)>=2.2,'cover stops a standing shot');}
 for(const building of BUILDINGS.filter(b=>b.enterable)){const door=doorRect(building),front=building.z<0?1:-1,p={x:door.x,z:door.z+front*1.3};assert.ok(canStand(p,PROTOTYPE.radius,worldSolids()));assert.ok(findRoute(PROTOTYPE.spawn,p).length,building.id+' entrance remains reachable');}
});
test('server bullets hit the new cover before the character behind it',()=>{
 const added=COVERS.filter(c=>c.id.startsWith('combat-'));assert.ok(added.length);
 for(const cover of added){const g=createNetworkGame(),a=g.join('a','sniper'),b=g.join('b');a.x=b.x=cover.x;a.z=cover.z-cover.depth/2-1.2;b.z=cover.z+cover.depth/2+1.2;
 g.input('a',{seq:1,x:0,y:0,yaw:0,pitch:0,fire:false,shot:true,reload:false,jump:false,sprint:false,scope:false});g.step();assert.equal(b.health,100,cover.id);assert.ok(Math.abs(g.state.events[0]!.to.z-(cover.z-cover.depth/2))<.01,cover.id+' uses the visible front face');}
});
