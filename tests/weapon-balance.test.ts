import test from 'node:test';
import assert from 'node:assert/strict';
import {WEAPONS} from '../src/weapons.ts';
import {createNetworkGame} from '../src/network-game.ts';

test('weapon damage follows the new role-based balance and keeps 1.5x sniper headshots lethal',()=>{
  assert.deepEqual(Object.fromEntries(Object.entries(WEAPONS).map(([id,w])=>[id,w.damage])),{
    pistol:22,machinegun:11,shotgun:15,sniper:70,smg:8,burst:17,quad:16,bazooka:110,dmr:42
  });
  assert.ok(WEAPONS.shotgun.damage*WEAPONS.shotgun.pellets<100,'full body shotgun hit needs a follow-up');
  assert.ok(WEAPONS.sniper.damage<100&&WEAPONS.sniper.damage*1.5>=100,'sniper rewards a headshot');
});

test('server applies the new DMR body damage over multiple hits',()=>{
 const game=createNetworkGame(),shooter=game.join('a','dmr'),target=game.join('b');shooter.z=10;
 for(let shot=0;shot<3;shot++){
  game.input('a',{seq:shot+1,x:0,y:0,yaw:0,pitch:.06,fire:false,shot:true,reload:false,jump:false,sprint:false,scope:false});game.step();
  if(shot<2){assert.equal(target.health,100-(shot+1)*42);for(let i=0;i<10;i++)game.step();}
 }
 assert.equal(target.health,0);assert.equal(shooter.kills,1);
});

test('server sniper body hit leaves health while the approved 1.5x headshot eliminates',()=>{
 for(const [pitch,remaining,headshot] of [[.04,30,false],[0,0,true]] as const){
  const game=createNetworkGame(),shooter=game.join('a','sniper'),target=game.join('b');
  shooter.x=0;shooter.z=-8;target.x=0;target.z=8;
  game.input('a',{seq:1,x:0,y:0,yaw:0,pitch,fire:false,shot:true,reload:false,jump:false,sprint:false,scope:false});game.step();
  assert.equal(target.health,remaining);assert.equal(game.state.events[0]?.headshot??false,headshot);
 }
});
