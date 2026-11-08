import test from 'node:test';import assert from 'node:assert/strict';import {createDuel,createBotMatch} from '../src/duel.ts';
test('equipment can heal an injured offline player without exceeding 100',()=>{const d=createDuel();d.hurt('player',25);assert.equal(d.healPlayer?.(50),25);assert.equal(d.state().playerHealth,100);});
test('self blast causes death without gifting a bot a kill',()=>{const g=createBotMatch();g.hurtSelf?.(100);assert.equal(g.state().playerHealth,0);assert.equal(g.state().bots.reduce((n,b)=>n+b.kills,0),0);});
