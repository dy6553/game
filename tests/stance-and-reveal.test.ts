import test from 'node:test';import assert from 'node:assert/strict';import {createNetworkGame,parseCommand} from '../src/network-game.ts';import {createWorld} from '../src/world.ts';import {combatContacts} from '../src/combat-hud.ts';
const command=(seq:number,extra={})=>({seq,x:0,y:1,yaw:0,pitch:0,fire:false,shot:false,reload:false,jump:false,sprint:false,scope:false,...extra});
test('server validates posture and applies slower movement and lower hit volume',()=>{
 assert.equal(parseCommand(command(1,{stance:'flying'})),null);
 const distances=[];for(const stance of ['stand','crouch','prone'] as const){const g=createNetworkGame(),a=g.join('a'),b=g.join('b');a.x=b.x=0;a.z=-8;b.z=8;g.input('a',command(1,{stance}));g.step();distances.push(a.z+8);assert.equal(a.stance,stance);}
 assert.ok(distances[0]!>distances[1]!&&distances[1]!>distances[2]!);
 const g=createNetworkGame(),a=g.join('a'),b=g.join('b');a.x=b.x=0;a.z=-8;b.z=8;b.stance='prone';g.input('b',command(1,{stance:'prone',y:0}));g.step();g.input('a',command(1,{y:0,shot:true}));g.step();assert.equal(b.health,100,'standing shot passes above prone target');
});
test('elevated firing reveals the shooter for four seconds, ground firing does not',()=>{
 const g=createNetworkGame(),a=g.join('a'),b=g.join('b'),w=createWorld(),building=w.BUILDINGS.find(b=>b.enterable)!;a.x=building.x;a.z=building.z;a.y=w.SECOND_FLOOR;b.x=0;b.z=0;
 g.input('a',command(1,{y:0,shot:true}));g.step();assert.equal(a.revealedUntil,g.state.tick+80);assert.equal(g.state.events[0]?.elevated,true);
 const obscured={...w,shotBoxes:()=>[{id:'wall',x:0,z:3,width:20,depth:1,yMin:0,yMax:10}]};const c=combatContacts(obscured,{}, {x:0,z:0},0,0,[{id:'enemy',name:'enemy',x:0,z:8,health:100,revealed:true}]);assert.equal(c.radar.length,1);assert.equal(c.target,undefined,'reveal does not grant aiming through walls');
});
