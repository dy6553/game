import test from 'node:test';
import assert from 'node:assert/strict';
import {createJump,beginJump,advanceJump} from '../src/jump.ts';

test('jump rises, lands exactly on ground and cannot double jump',()=>{
  let state=beginJump(createJump());state=advanceJump(state,0.2);
  assert.ok(state.height>0);assert.equal(beginJump(state),state);
  state=advanceJump(state,0.6);assert.deepEqual(state,createJump());
  assert.ok(beginJump(state).velocity>0);
});
test('jump trajectory agrees across different frame rates and rejects invalid time',()=>{
  const a=advanceJump(beginJump(createJump()),0.3);
  let b=beginJump(createJump());for(let i=0;i<30;i++)b=advanceJump(b,0.01);
  assert.ok(Math.abs(a.height-b.height)<1e-9);assert.ok(Math.abs(a.velocity-b.velocity)<1e-9);
  assert.throws(()=>advanceJump(b,-1));
});
