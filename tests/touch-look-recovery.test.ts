import test from 'node:test';
import assert from 'node:assert/strict';
import {createInput} from '../src/input.ts';
function fixture(){
 class Element extends EventTarget{style={transform:''};focus(){}setPointerCapture(_id:number){}getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}}
 const elements=new Map(['game','joystick','joystick-thumb','fire','reload','jump','sprint','dash'].map(id=>[id,new Element()]));
 const doc=Object.assign(new EventTarget(),{hidden:false,pointerLockElement:null,querySelector:(s:string)=>elements.get(s.slice(1))??null}),win=new EventTarget();
 const previous=new Map(['document','window'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));Object.defineProperty(globalThis,'document',{value:doc,configurable:true});Object.defineProperty(globalThis,'window',{value:win,configurable:true});
 const send=(id:string,type:string,props:Record<string,unknown>)=>(id==='window'?win:elements.get(id)!).dispatchEvent(Object.assign(new Event(type,{cancelable:true}),{pointerType:'touch',button:0,...props}));
 const input=createInput(elements.get('game') as unknown as HTMLCanvasElement);
 return {input,send,cleanup(){for(const [key,old] of previous)if(old)Object.defineProperty(globalThis,key,old);else Reflect.deleteProperty(globalThis,key);}};
}
test('look can start on every repeated drag when release lands outside canvas while movement stays held',()=>{
 const {input,send,cleanup}=fixture();try{
  send('joystick','pointerdown',{pointerId:1,clientX:50,clientY:20});
  for(let i=0;i<20;i++){const id=10+i,before=input.look.yaw;send('game','pointerdown',{pointerId:id,clientX:100,clientY:50});send('game','pointermove',{pointerId:id,clientX:120,clientY:50});assert.notEqual(input.look.yaw,before,`drag ${i+1} must rotate`);send('window','pointerup',{pointerId:id});assert.ok(input.move.y>0,'releasing view never clears the movement finger');}
 }finally{cleanup();}
});
test('cancel outside canvas also releases the matching view pointer and duplicate releases never fire a shot',()=>{
 const {input,send,cleanup}=fixture();try{send('game','pointerdown',{pointerId:3,clientX:100,clientY:50});send('window','pointercancel',{pointerId:3});send('game','pointerdown',{pointerId:4,clientX:100,clientY:50});send('game','pointermove',{pointerId:4,clientX:150,clientY:50});assert.ok(input.look.yaw>0);send('game','pointerup',{pointerId:4});send('window','pointerup',{pointerId:4});assert.equal(input.consumeShots(),0);}finally{cleanup();}
});
test('default mobile swipe is faster while PC mouse calibration remains unchanged',()=>{
 const {input,send,cleanup}=fixture();try{send('game','pointerdown',{pointerId:2,clientX:100,clientY:50});send('game','pointermove',{pointerId:2,clientX:200,clientY:50});assert.ok(Math.abs(input.look.yaw-.7)<1e-8,'100px swipe rotates 0.7 radians');send('game','pointerup',{pointerId:2});input.resetLook();send('game','pointerdown',{pointerId:3,pointerType:'mouse',clientX:100,clientY:50});send('game','pointermove',{pointerId:3,pointerType:'mouse',clientX:200,clientY:50});assert.ok(Math.abs(input.look.yaw-.4)<1e-8);}finally{cleanup();}
});

test('mouse sensitivity changes desktop aim while touch sensitivity stays independent',()=>{const {input,send,cleanup}=fixture();try{input.setMouseSensitivity(1);send('game','pointermove',{pointerType:'mouse',clientX:0,clientY:0});send('game','pointermove',{pointerType:'mouse',clientX:10,clientY:0});const normal=input.look.yaw;input.resetLook();input.setMouseSensitivity(2);send('game','pointermove',{pointerType:'mouse',clientX:0,clientY:0});send('game','pointermove',{pointerType:'mouse',clientX:10,clientY:0});assert.ok(Math.abs(input.look.yaw-normal*2)<1e-9);input.resetLook();send('game','pointerdown',{pointerId:9,clientX:0,clientY:0});send('game','pointermove',{pointerId:9,clientX:10,clientY:0});const touch=input.look.yaw;input.resetLook();input.setMouseSensitivity(.5);send('game','pointerdown',{pointerId:10,clientX:0,clientY:0});send('game','pointermove',{pointerId:10,clientX:10,clientY:0});assert.equal(input.look.yaw,touch);}finally{cleanup();}});
