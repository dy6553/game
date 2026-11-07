import test from 'node:test';
import assert from 'node:assert/strict';
import * as dash from '../src/dash.ts';
import {moveWithCollisions,canStand,PROTOTYPE} from '../src/world.ts';
const input=(patch={})=>({x:0,y:0,yaw:0,grounded:true,canAct:true,...patch});
function ready(){assert.equal(typeof dash.createDash,'function','shared dash state must exist');return dash.createDash();}
test('dash travels four meters in 0.2 seconds independently of frame subdivisions',()=>{
 for(const steps of [[.2],[.1,.1],Array(8).fill(.025)]){let s=dash.beginDash(ready(),input()),x=0,z=0;for(const dt of steps){const r=dash.advanceDash(s,dt);s=r.state;x+=r.delta.x;z+=r.delta.z;}assert.ok(Math.abs(z-4)<1e-8);assert.equal(x,0);assert.equal(s.remaining,0);assert.ok(Math.abs(s.cooldown-2.8)<1e-8);}
});
test('movement direction is normalized and locked; stationary dash follows horizontal view',()=>{
 let s=dash.beginDash(ready(),input({x:1,y:1}));const r=dash.advanceDash(s,.2);assert.ok(Math.abs(Math.hypot(r.delta.x,r.delta.z)-4)<1e-8);assert.ok(Math.abs(r.delta.x-r.delta.z)<1e-8);
 s=dash.beginDash(ready(),input({yaw:Math.PI/2}));const q=dash.advanceDash(s,.2);assert.ok(Math.abs(q.delta.x-4)<1e-8);assert.ok(Math.abs(q.delta.z)<1e-8);
});
test('cooldown begins at activation, cannot be restarted, and cancellation preserves its cost',()=>{
 let s=dash.beginDash(ready(),input());s=dash.advanceDash(s,.1).state;assert.equal(dash.beginDash(s,input()),s);const c=dash.cancelDash(s);assert.equal(c.remaining,0);assert.equal(c.cooldown,s.cooldown);assert.equal(dash.beginDash(c,input()),c);s=dash.advanceDash(c,2.9).state;assert.equal(s.cooldown,0);assert.ok(dash.beginDash(s,input()).remaining>0);
});
test('airborne and inactive players cannot dash, invalid inputs cannot create movement',()=>{
 const s=ready();assert.equal(dash.beginDash(s,input({grounded:false})),s);assert.equal(dash.beginDash(s,input({canAct:false})),s);for(const dt of [-1,NaN,Infinity])assert.throws(()=>dash.advanceDash(s,dt));assert.throws(()=>dash.beginDash(s,input({yaw:NaN})));
});
test('dash collision sweep cannot tunnel through thin walls',()=>{
 const wall=[{id:'wall',x:5,z:0,width:.1,depth:10}],s=dash.beginDash(ready(),input({yaw:Math.PI/2})),r=dash.advanceDash(s,.2),p=moveWithCollisions({x:3,z:0},r.delta,wall);assert.ok(p.x<5-PROTOTYPE.radius);assert.ok(canStand(p,PROTOTYPE.radius,wall));
});
