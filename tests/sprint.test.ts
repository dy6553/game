import test from 'node:test';
import assert from 'node:assert/strict';
import { sprintMultiplier,type SprintConditions } from '../src/sprint.ts';
import { moveWithCollisions,PROTOTYPE } from '../src/world.ts';
const ready:SprintConditions={requested:true,forward:1,canAct:true,firing:false,reloading:false,scoped:false};
test('sprint applies only to requested forward movement outside combat actions',()=>{
 assert.equal(sprintMultiplier(ready,1.5),1.5);
 for(const patch of [{requested:false},{forward:0},{forward:-1},{canAct:false},{firing:true},{reloading:true},{scoped:true}])assert.equal(sprintMultiplier({...ready,...patch},1.5),1);
});
test('sprinting still cannot tunnel through thin walls',()=>{
 const wall={id:'wall',x:2,z:0,width:.2,depth:5};
 const p=moveWithCollisions({x:0,z:0},{x:PROTOTYPE.speed*sprintMultiplier(ready,1.5),z:0},[wall]);
 assert.ok(p.x<=1.9-PROTOTYPE.radius+1e-6);
 assert.throws(()=>sprintMultiplier(ready,Infinity));
});
