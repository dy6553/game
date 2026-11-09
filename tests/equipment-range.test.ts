import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceEquipment,createGear,type GearActor,type Projectile} from '../src/equipment.ts';
import type {World} from '../src/world.ts';
function run(kind:Projectile['kind'],x:number,y=1,direct?:string,blocked=false){
 let queries=0,damage=0;
 const actor:GearActor={id:'target',x,y:0,z:0,yaw:-Math.PI/2,pitch:0,health:100,gear:createGear(),healing:0,flash:0,gearCooldown:0};
 const world={shotBoxes(){queries++;return blocked?[{id:'wall',x:1,z:0,width:.2,depth:10,yMin:0,yMax:10}]:[];}} as unknown as World;
 const projectiles:Projectile[]=[{id:1,owner:'owner',kind,x:0,y,z:0,vx:0,vy:0,vz:0,remaining:0,direct}];
 advanceEquipment([actor],projectiles,0,world,{},(_,amount)=>{damage+=amount;},()=>2);
 return {queries,damage,flash:actor.flash};
}
test('out-of-range explosions skip occlusion queries including elevated flash distance',()=>{
 for(const [kind,x,y] of [['grenade',6,1],['rocket',6,1],['flash',8,1],['flash',0,10]] as const){
  const r=run(kind,x,y);assert.equal(r.damage,0);assert.equal(r.flash,0);assert.equal(r.queries,1,kind);
 }
});
test('range filtering preserves nearby damage, occlusion, flash and direct rocket hits',()=>{
 assert.equal(run('grenade',3).damage,50);
 assert.equal(run('grenade',3,1,undefined,true).damage,0);
 assert.ok(run('flash',3).flash>0);
 assert.equal(run('rocket',6,1,'target').damage,100);
 assert.equal(run('rocket',6,1,'target',true).damage,0);
});
