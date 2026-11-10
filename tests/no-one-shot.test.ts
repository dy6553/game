import test from 'node:test';
import assert from 'node:assert/strict';
import {WEAPON_IDS,upgradedWeapon} from '../src/weapons.ts';
import {createNetworkGame} from '../src/network-game.ts';
test('one bullet, all shotgun pellets, or a direct rocket cannot eliminate full health even with bot upgrades',()=>{
 for(const id of WEAPON_IDS)for(let tier=0;tier<=3;tier++){
  const spec=upgradedWeapon(id,tier,true);
  const maximum=spec.damage*spec.pellets*(id==='bazooka'?1:1.5);
  assert.ok(maximum<100,`${id} tier ${tier} can deal ${maximum} in one shot`);
 }
});
test('server sniper headshot leaves full-health opponent alive',()=>{
 const game=createNetworkGame(),a=game.join('a','sniper'),b=game.join('b');a.x=0;a.z=-8;b.x=0;b.z=8;
 game.input('a',{seq:1,x:0,y:0,yaw:0,pitch:0,fire:false,shot:true,reload:false,jump:false,sprint:false,scope:false});game.step();
 assert.ok(b.health>0&&b.health<100);assert.equal(a.kills,0);assert.equal(game.state.events[0]?.headshot,true);
});
