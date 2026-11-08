import test from 'node:test';import assert from 'node:assert/strict';
import {upgradedWeapon,WEAPONS} from '../src/weapons.ts';
import {isCharacterType} from '../src/characters.ts';
test('unlocked upgrades change only bot damage and reload without mutating online specs',()=>{
 const gun=upgradedWeapon('pistol',3,true);assert.equal(gun.damage,28.749999999999996);assert.equal(gun.reloadSeconds,1.275);
 assert.deepEqual(upgradedWeapon('pistol',3,false),WEAPONS.pistol);assert.equal(WEAPONS.pistol.damage,25);
 assert.equal(upgradedWeapon('pistol',20,true).reloadSeconds,1.275);
});
test('welding robot is a supported cosmetic character',()=>assert.equal(isCharacterType('welder'),true));
