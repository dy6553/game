import test from 'node:test';
import assert from 'node:assert/strict';
import {createWeapon,tryFire,beginReload,advanceWeapon,applyDamage,validateCombatRules} from '../src/combat.ts';

// Fixtures exercise boundaries; they are not the unconfirmed game balance.
const rules={maxHealth:70,damage:19,magazineSize:3,reloadSeconds:0.7};
test('each shot consumes one round and an empty weapon cannot fire',()=>{
  let state=createWeapon(rules);
  for(let i=0;i<3;i++){const shot=tryFire(state);assert.ok(shot.fired);state=shot.state;}
  const empty=tryFire(state);assert.equal(empty.fired,false);assert.equal(empty.reason,'empty');assert.equal(empty.state.ammo,0);
});
test('reloading blocks shots, repeated reload does not reset the timer, completion fills once',()=>{
  let state=tryFire(createWeapon(rules)).state;
  state=beginReload(state,rules);
  assert.equal(tryFire(state).reason,'reloading');
  state=advanceWeapon(state,0.3,rules);
  const repeated=beginReload(state,rules);assert.deepEqual(repeated,state);
  assert.equal(state.ammo,2);
  state=advanceWeapon(state,0.4,rules);assert.deepEqual(state,{ammo:3,reloadRemaining:0});
  assert.deepEqual(advanceWeapon(state,8,rules),state);
  assert.deepEqual(beginReload(state,rules),state,'full magazine does not reload');
});
test('damage clamps health at zero and elimination triggers only on the transition',()=>{
  let health=rules.maxHealth;
  for(let i=0;i<3;i++){const hit=applyDamage(health,rules.damage);assert.equal(hit.eliminated,false);health=hit.health;}
  const final=applyDamage(health,rules.damage);assert.deepEqual(final,{health:0,eliminated:true});
  assert.deepEqual(applyDamage(final.health,rules.damage),{health:0,eliminated:false});
});
test('invalid rule and time values cannot silently grant ammunition or health',()=>{
  assert.throws(()=>validateCombatRules({...rules,magazineSize:1.5}));
  assert.throws(()=>validateCombatRules({...rules,damage:NaN}));
  assert.throws(()=>advanceWeapon(createWeapon(rules),-1,rules));
  assert.throws(()=>applyDamage(10,-1));
});
