import test from 'node:test';import assert from 'node:assert/strict';import {chooseOnlineNickname} from '../src/member-nickname-entry.ts';
test('members see their current name and can save a replacement before entering',async()=>{
 const saved:string[]=[];const name=await chooseOnlineNickname({member:true,nickname:'기존대원'},async(member,save,initial)=>{assert.equal(member,true);assert.equal(initial,'기존대원');await save?.('새로운대원');return '새로운대원';},async value=>{saved.push(value);});
 assert.equal(name,'새로운대원');assert.deepEqual(saved,['새로운대원']);
});
test('unchanged member names do not rewrite the profile; guests never write it',async()=>{
 let writes=0;const save=async()=>{writes++;};assert.equal(await chooseOnlineNickname({member:true,nickname:'기존대원'},async(_m,onSave,initial)=>{await onSave?.(initial);return initial;},save),'기존대원');assert.equal(await chooseOnlineNickname({member:false,nickname:''},async(member,onSave)=>{assert.equal(member,false);assert.equal(onSave,undefined);return '손님대원';},save),'손님대원');assert.equal(writes,0);
});
