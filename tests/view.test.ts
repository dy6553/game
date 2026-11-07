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
