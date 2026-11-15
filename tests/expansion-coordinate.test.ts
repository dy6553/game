import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld} from '../src/world.ts';

test('new-map collision follows glTF handedness conversion so text and geometry need no mirrored art',()=>{
 const bytes=readFileSync(new URL('../public/maps/moon-low.glb',import.meta.url));
 const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 const extras=doc.nodes.find(n=>n.extras?.map_id==='moon').extras;
 const source=JSON.parse(extras.rooms_json)[0],world=createWorld('moon');
 assert.equal(world.BUILDINGS[0].x,-source.x);
 assert.equal(world.BUILDINGS[0].z,source.z);
});
