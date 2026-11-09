import test from 'node:test';
import assert from 'node:assert/strict';
import { turnView, viewMovement } from '../src/view.ts';
import { createInput } from '../src/input.ts';

test('right swipe turns right and vertical view clamps before inversion', () => {
  assert.ok(turnView({yaw:0,pitch:0},40,0).yaw>0);
  assert.ok(turnView({yaw:0,pitch:0},-40,0).yaw<0);
  assert.equal(turnView({yaw:0,pitch:0},0,10000).pitch,1.2);
  assert.equal(turnView({yaw:0,pitch:0},0,-10000).pitch,-1.2);
});
test('movement follows yaw, strafing is perpendicular and diagonals are normalized', () => {
  const f=viewMovement(Math.PI/2,0,1),r=viewMovement(Math.PI/2,1,0);
  assert.ok(Math.abs(f.x-1)<1e-9 && Math.abs(f.z)<1e-9);
  assert.ok(Math.abs(f.x*r.x+f.z*r.z)<1e-9);
  const d=viewMovement(1.7,1,1);assert.ok(Math.abs(Math.hypot(d.x,d.z)-1)<1e-9);
});
test('independent touches move, turn and fire; cancellation releases only the matching pointer', () => {
  class Element extends EventTarget {
    style={transform:''}; focus(){} setPointerCapture(_id:number){}
    getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}
  }
  const canvas=new Element(),stick=new Element(),thumb=new Element(),fire=new Element(),reload=new Element(),jump=new Element(),sprint=new Element();
  const doc=Object.assign(new EventTarget(),{hidden:false,pointerLockElement:null,
    querySelector(s:string){return s==='#joystick'?stick:s==='#fire'?fire:s==='#reload'?reload:s==='#jump'?jump:s==='#sprint'?sprint:thumb;}});
  const win=new EventTarget();
  const oldDoc=Object.getOwnPropertyDescriptor(globalThis,'document'),oldWin=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'document',{value:doc,configurable:true});
  Object.defineProperty(globalThis,'window',{value:win,configurable:true});
  const send=(el:Element,type:string,id:number,x:number,y:number)=>el.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),{pointerId:id,clientX:x,clientY:y,pointerType:'touch'}));
  try {
    const input=createInput(canvas as unknown as HTMLCanvasElement);
    assert.equal(input.sprintingRequested,false);
    win.dispatchEvent(Object.assign(new Event('keydown',{cancelable:true}),{code:'ShiftLeft',repeat:false}));assert.equal(input.sprintingRequested,true);
    win.dispatchEvent(Object.assign(new Event('keyup'),{code:'ShiftLeft'}));assert.equal(input.sprintingRequested,false);
    send(sprint,'pointerdown',9,50,100);assert.equal(input.sprintingRequested,true);
    input.reset();assert.equal(input.sprintingRequested,false,'reset clears mobile sprint');
    send(stick,'pointerdown',1,50,17);send(canvas,'pointerdown',2,120,50);send(canvas,'pointermove',2,160,50);
    send(fire,'pointerdown',3,200,100);
    assert.equal(input.firing,true,'fire finger stays held independently');
    send(fire,'pointercancel',3,200,100);assert.equal(input.firing,false,'cancel stops automatic fire');
    assert.equal(input.move.y,1);assert.ok(input.look.yaw>0);assert.equal(input.consumeShots(),1);assert.equal(input.consumeShots(),0);
    send(reload,'pointerdown',5,180,100);assert.equal(input.consumeReloads(),1);assert.equal(input.consumeReloads(),0);
    win.dispatchEvent(Object.assign(new Event('keydown',{cancelable:true}),{code:'KeyR',repeat:false}));
    win.dispatchEvent(Object.assign(new Event('keydown',{cancelable:true}),{code:'KeyR',repeat:true}));
    assert.equal(input.consumeReloads(),1,'R key repeat does not queue multiple reloads');
    send(jump,'pointerdown',6,200,150);assert.equal(input.consumeJumps(),1);
    win.dispatchEvent(Object.assign(new Event('keydown',{cancelable:true}),{code:'Space',repeat:false}));
    win.dispatchEvent(Object.assign(new Event('keydown',{cancelable:true}),{code:'Space',repeat:true}));
    assert.equal(input.consumeJumps(),1,'jump key repeat does not queue an automatic jump');
    const yaw=input.look.yaw;send(canvas,'pointercancel',2,160,50);send(canvas,'pointermove',2,200,50);
    assert.equal(input.look.yaw,yaw);assert.equal(input.move.y,1);assert.equal(input.consumeShots(),0,'swiping does not fire');
    send(stick,'pointercancel',1,50,17);assert.deepEqual(input.move,{x:0,y:0});
    send(stick,'pointerdown',4,50,17);win.dispatchEvent(new Event('blur'));assert.deepEqual(input.move,{x:0,y:0});assert.equal(input.sprintingRequested,false,'blur clears sprint');
    input.setEnabled(false);
    win.dispatchEvent(Object.assign(new Event('keydown'),{code:'KeyW',repeat:false}));
    send(canvas,'pointerdown',10,100,50);send(canvas,'pointermove',10,120,50);send(fire,'pointerdown',11,200,100);
    assert.deepEqual(input.move,{x:0,y:0});assert.equal(input.consumeShots(),0);assert.equal(input.look.yaw,yaw,'paused view cannot turn');
    input.setEnabled(true);assert.deepEqual(input.move,{x:0,y:0},'resume cannot inherit paused keys');
    input.resetLook();input.setTouchSensitivity(.5);send(canvas,'pointerdown',12,100,50);send(canvas,'pointermove',12,120,50);
    const half=input.look.yaw;input.resetLook();input.setTouchSensitivity(1.5);send(canvas,'pointerdown',13,100,50);send(canvas,'pointermove',13,120,50);
    assert.ok(Math.abs(input.look.yaw-half*3)<1e-9,'mobile sensitivity changes swipe rotation');
    input.reset();let locks=0;Object.assign(canvas,{requestPointerLock(){locks++;}});
    canvas.dispatchEvent(new Event('dblclick'));assert.equal(locks,0,'double-click is no longer a pointer-lock gesture');

  }finally{
    if(oldDoc)Object.defineProperty(globalThis,'document',oldDoc);else Reflect.deleteProperty(globalThis,'document');
    if(oldWin)Object.defineProperty(globalThis,'window',oldWin);else Reflect.deleteProperty(globalThis,'window');
  }
});

function desktopFixture(run:(canvas:any,doc:any,send:(type:string,props?:object)=>void)=>void){
 class E extends EventTarget{style={transform:''};focus(){}setPointerCapture(){}getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}}
 const canvas=new E(),el=new E(),doc=Object.assign(new EventTarget(),{hidden:false,pointerLockElement:null as E|null,querySelector:()=>el});const oldDoc=Object.getOwnPropertyDescriptor(globalThis,'document'),oldWin=Object.getOwnPropertyDescriptor(globalThis,'window');Object.defineProperty(globalThis,'document',{value:doc,configurable:true});Object.defineProperty(globalThis,'window',{value:new EventTarget(),configurable:true});
 const send=(type:string,props={})=>canvas.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),{pointerType:'mouse',pointerId:1,button:0,clientX:20,clientY:20,...props}));
 try{run(canvas,doc,send);}finally{if(oldDoc)Object.defineProperty(globalThis,'document',oldDoc);else Reflect.deleteProperty(globalThis,'document');if(oldWin)Object.defineProperty(globalThis,'window',oldWin);else Reflect.deleteProperty(globalThis,'window');}
}
test('locked desktop mousemove turns without holding a button and pointermove never doubles motion',()=>desktopFixture((canvas,doc,send)=>{
 const input=createInput(canvas);doc.pointerLockElement=canvas;const move=()=>doc.dispatchEvent(Object.assign(new Event('mousemove'),{movementX:40,movementY:20}));move();assert.ok(input.look.yaw>0,'document mousemove must turn the locked camera');const look={...input.look};send('pointermove',{movementX:40,movementY:20});assert.deepEqual(input.look,look,'pointermove cannot double the same physical motion');assert.equal(input.consumeShots(),0);input.setEnabled(false);move();assert.deepEqual(input.look,look);input.setEnabled(true);doc.pointerLockElement=null;move();assert.deepEqual(input.look,look);
}));
test('first PC click locks aim without firing, locked clicks fire, touch and fallback still drag',()=>desktopFixture((canvas,doc,send)=>{
 let requests=0,auto=true;const input=createInput(canvas,{requestMouseLock(){if(!auto)return false;requests++;return true;}});send('pointerdown');send('pointerup');assert.equal(requests,1,'gameplay click must request aim lock');assert.equal(input.consumeShots(),0,'activation cannot waste ammo');send('pointerdown',{button:2});assert.equal(requests,1);doc.pointerLockElement=canvas;doc.dispatchEvent(new Event('pointerlockchange'));send('pointerdown');assert.equal(input.consumeShots(),1);assert.equal(input.firing,true);send('pointerup');assert.equal(input.firing,false);doc.pointerLockElement=null;doc.dispatchEvent(new Event('pointerlockchange'));send('pointerdown',{pointerType:'touch'});send('pointermove',{pointerType:'touch',clientX:60});assert.ok(input.look.yaw>0);send('pointerup',{pointerType:'touch'});assert.equal(requests,1);auto=false;send('pointerdown');send('pointerup');assert.equal(input.consumeShots(),1);input.setEnabled(false);send('pointerdown');assert.equal(requests,1,'pause must not request pointer lock');
}));

test('PC hover turns without click or lock, resets on entry/pause, and never aims over other controls',()=>desktopFixture((canvas,doc,send)=>{
 const input=createInput(canvas);send('pointermove',{clientX:100,clientY:80});send('pointermove',{clientX:140,clientY:90});assert.ok(input.look.yaw>0,'hover must turn without pointerdown');assert.equal(input.consumeShots(),0);const look={...input.look};input.setEnabled(false);send('pointermove',{clientX:900,clientY:400});assert.deepEqual(input.look,look);input.setEnabled(true);send('pointermove',{clientX:900,clientY:400});assert.deepEqual(input.look,look,'resume primes pointer position instead of snapping');send('pointermove',{clientX:920,clientY:400});assert.ok(input.look.yaw>look.yaw);const next={...input.look};send('pointerleave');send('pointermove',{clientX:10,clientY:10});assert.deepEqual(input.look,next,'re-entering cannot jump across the screen');doc.dispatchEvent(Object.assign(new Event('mousemove'),{movementX:100,movementY:20}));assert.deepEqual(input.look,next,'unlocked motion outside canvas cannot aim');send('pointermove',{pointerType:'touch',clientX:80,clientY:10});assert.deepEqual(input.look,next,'touch still requires an active drag');send('pointerdown',{clientX:10,clientY:10});assert.equal(input.firing,true,'holding fire must still work without pointer lock');assert.equal(input.consumeShots(),1);send('pointerup',{clientX:10,clientY:10});assert.equal(input.firing,false);assert.equal(input.consumeShots(),0,'release cannot fire a second shot');
}));

test('desktop hover and pointer lock use the same fine-grained sensitivity without frame-dependent smoothing',()=>desktopFixture((canvas,doc,send)=>{
 const input=createInput(canvas);
 const hover=(scale:number)=>{input.reset();input.resetLook();input.setMouseSensitivity(scale);send('pointermove',{clientX:100,clientY:100});send('pointermove',{clientX:140,clientY:120});return {...input.look};};
 const base=hover(1),fine=hover(.1),fast=hover(3);
 assert.ok(Math.abs(fine.yaw-base.yaw*.1)<1e-9,'0.10x supports precise aim');
 assert.ok(Math.abs(fast.yaw-base.yaw*3)<1e-9,'3.00x remains selectable');
 input.reset();input.resetLook();input.setMouseSensitivity(1);doc.pointerLockElement=canvas;
 doc.dispatchEvent(Object.assign(new Event('mousemove'),{movementX:40,movementY:20}));
 assert.ok(Math.abs(input.look.yaw-base.yaw)<1e-9,'locking must not change horizontal sensitivity');
 assert.ok(Math.abs(input.look.pitch-base.pitch)<1e-9,'locking must not change vertical sensitivity');
}));

test('scoped desktop aiming follows the zoom ratio immediately and restores normal aim on exit',()=>desktopFixture((canvas,doc,send)=>{
 let scale=1;const input=createInput(canvas,{mouseScale:()=>scale});doc.pointerLockElement=canvas;
 const move=()=>doc.dispatchEvent(Object.assign(new Event('mousemove'),{movementX:40,movementY:0}));
 move();const normal=input.look.yaw;input.resetLook();scale=.3;move();
 assert.ok(Math.abs(input.look.yaw-normal*.3)<1e-9,'scope should preserve fine screen-space aim');
 input.resetLook();scale=1;move();assert.ok(Math.abs(input.look.yaw-normal)<1e-9);
}));
