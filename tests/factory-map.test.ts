import test from 'node:test';import assert from 'node:assert/strict';
import {createWorld,harborWorld} from '../src/world.ts';import {createBotRules} from '../src/duel.ts';
import {createPickups} from '../src/inventory.ts';
test('factory has its own layout, traversable supplies, outdoor spawns and independent caches',()=>{
 const f=createWorld('factory');assert.notDeepEqual(f.BUILDINGS,harborWorld.BUILDINGS);
 for(const p of createPickups())assert.ok(f.canStand(p,.55),p.id);
 for(let n=0;n<30;n++){const p=f.randomOutdoorSpawn([],()=>n/30);assert.equal(f.indoorAt(p),undefined);assert.ok(f.canStand(p,.55));}
 const rules=createBotRules(f);assert.ok(rules.findRoute({x:0,z:-8},{x:0,z:18}).length);
 const before=harborWorld.worldSolids();f.worldSolids(f.createDoors());assert.equal(harborWorld.worldSolids(),before);
});
