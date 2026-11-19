import test from 'node:test';
import assert from 'node:assert/strict';
import {createNetworkGame} from '../src/network-game.ts';

test('only the host changes a waiting map and the chosen map survives start',()=>{
 const game=createNetworkGame(undefined,'harbor',{mode:'ffa',waitingRoom:true,randomPickups:true});
 game.join('host','pistol','robot',{nickname:'Host',guest:true});
 game.join('guest','pistol','robot',{nickname:'Guest',guest:true});
 assert.equal(game.changeMap('guest','snow'),false);
 assert.equal(game.state.map,'harbor');
 assert.equal(game.changeMap('host','snow'),true);
 assert.equal(game.state.map,'snow');
 assert.ok(game.state.animals);
 assert.equal(game.changeMap('host','moon'),true);
 assert.equal(game.state.map,'moon');
 assert.equal(game.state.animals,undefined);
 assert.equal(game.startMatch('host'),true);
 assert.equal(game.changeMap('host','harbor'),false);
 assert.equal(game.state.map,'moon');
});
