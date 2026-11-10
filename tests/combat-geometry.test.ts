import test from 'node:test';
import assert from 'node:assert/strict';
import {boxHit,firstShotBox,unobstructed} from '../src/combat-geometry.ts';
import {createWorld,type Rect} from '../src/world.ts';

test('bot sight skips distant rectangles before doing vertical collision math',()=>{
 let distantChecks=0;
 const far:Rect={id:'far',x:30,z:2,width:1,depth:1,get yMin(){distantChecks++;return 0;},yMax:3};
 const wall:Rect={id:'wall',x:0,z:2,width:1,depth:1,yMin:0,yMax:3};
 const world={...createWorld(),shotBoxes:()=>[far,wall]};
 assert.equal(unobstructed(world,{}, {x:0,y:1,z:0},{x:0,y:1,z:4}),false);
 assert.equal(distantChecks,0);
});

test('sight matches exact collision across both maps, heights and door states',()=>{
 for(const map of ['harbor','factory'] as const){
  const world=createWorld(map);
  for(const doors of [world.createDoors(),Object.fromEntries(Object.keys(world.createDoors()).map(id=>[id,true]))]){
   const boxes=world.shotBoxes(doors);
   for(let i=0;i<250;i++){
    const a={x:(i*17%119)-59,y:i%9,z:(i*31%89)-56};
    const b={x:(i*29%119)-59,y:i%8,z:(i*41%89)-56};
    let nearest:ReturnType<typeof boxHit>=null;
    for(const box of boxes){
     const hit=boxHit(a,b,box);
     if(hit&&(!nearest||hit.t<nearest.t))nearest=hit;
    }
    assert.deepEqual(firstShotBox(world,doors,a,b),nearest);
    assert.equal(unobstructed(world,doors,a,b),nearest===null||nearest.t>=.995);
   }
  }
 }
});
