import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Ray} from '@babylonjs/core/Culling/ray.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {createHarborScene} from '../src/scene.ts';

test('harbor art uses the game coordinates while original door collision still responds', async () => {
  const engine = new NullEngine();
  const data = await readFile(new URL('../public/maps/harbor-full-low.glb', import.meta.url));
  try {
    const requests:string[] = [];
    const world = createHarborScene(engine, {mapArtSource: profile => { requests.push(profile); return data; }});
    const legacyDoor = world.scene.getMeshByName('building-0-1-interactive-door')!;
    const originalVisibility = legacyDoor.visibility;
    await world.setQuality(true);
    assert.deepEqual(requests, [], 'high renders the original art without requesting a map asset');
    assert.equal(legacyDoor.visibility, originalVisibility);
    world.setPerformanceLow(true);
    await world.setQuality(false);
    const art = world.scene.getNodeByName('harbor-art-low');
    assert.ok(art, 'the requested low model is attached to the scene');
    const door = art.getDescendants().find(node => node.name === 'building-0-1-interactive-door');
    assert.ok(door && 'getAbsolutePosition' in door);
    door.computeWorldMatrix(true);
    assert.ok(Vector3.Distance(door.getAbsolutePosition(), new Vector3(-18.6, 1.6, -12.7)) < .001);
    const shot = new Ray(new Vector3(-17, 1.95, -11.5), new Vector3(0, 0, -1), 4);
    const pick = () => world.scene.pickWithRay(shot, mesh => mesh.isPickable && mesh.isEnabled());
    assert.equal(pick()?.hit, true);
    assert.equal(world.toggleDoor({x: -17, z: -11.5}, 'building-0-1'), true);
    world.scene.render();
    assert.equal(pick()?.hit, false);
    assert.notEqual(door.rotation.y, 0);
    const artMeshes = new Set(art.getChildMeshes());
    for (const building of world.geometry.BUILDINGS.filter(item => item.enterable)) {
      const y = world.geometry.SECOND_FLOOR;
      const deck = world.geometry.balcony(building, y);
      for (const x of [deck.x, deck.x - building.width*.4, deck.x + building.width*.4]) {
        const front = building.z < 0 ? 1 : -1;
        const land = world.scene.pickWithRay(
          new Ray(new Vector3(x, y + 1, deck.z), new Vector3(0, -1, 0), 1.1),
          mesh => artMeshes.has(mesh),
        );
        assert.ok(land?.pickedPoint && Math.abs(land.pickedPoint.y - y) < .001,
          `${building.id} balcony has a visible floor at collision height ${y}`);
        if(x===deck.x){
          const exit = world.scene.pickWithRay(
            new Ray(new Vector3(x, y + 1, deck.z), new Vector3(0, 0, -front), 2),
            mesh => artMeshes.has(mesh),
          );
          assert.equal(exit?.hit, false, `${building.id} balcony opening is clear at ${y}`);
        }
      }
    }
    await world.setQuality(true);
    assert.equal(world.scene.getNodeByName('harbor-art-low'), null);
    assert.equal(legacyDoor.visibility, originalVisibility);
    assert.deepEqual(requests, ['low'], 'switching back to high releases the low model without another request');
    assert.notEqual(legacyDoor.rotation.y, 0, 'the door stays open across a quality switch');
    assert.equal(pick()?.hit, false);
    await world.setPerformanceLow(false);
    await world.setQuality(false);
    assert.ok(world.scene.getNodeByName('harbor-art-balanced'));
    assert.deepEqual(requests, ['low','balanced']);
    assert.equal(world.scene.getNodeByName('harbor-art-low'), null);
    world.scene.dispose();
  } finally {
    engine.dispose();
  }
});
