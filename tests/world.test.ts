import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, COVERS, SOLIDS, PROTOTYPE, canStand, circleOverlapsRect, moveWithCollisions, normalized } from '../src/world.ts';

test('spawn and connected main/side streets are walkable', () => {
  assert.ok(canStand(PROTOTYPE.spawn, PROTOTYPE.radius));
  for (const x of [-25, 0, 25]) for (const z of [-30, -15, 0, 15, 30]) {
    assert.ok(canStand({ x, z }, PROTOTYPE.radius), `street ${x},${z}`);
  }
});

test('buildings and cover block their exact footprints', () => {
  for (const rect of [...BUILDINGS, ...COVERS]) {
    assert.equal(canStand(rect, PROTOTYPE.radius), false, rect.id);
  }
});

test('fast movement cannot cross a thin wall', () => {
  const wall = { id: 'wall', x: 3, z: 0, width: 0.2, depth: 8 };
  const p = moveWithCollisions({ x: 0, z: 0 }, { x: 20, z: 0 }, [wall]);
  assert.ok(p.x <= 2.9 - PROTOTYPE.radius + 1e-6);
  assert.equal(circleOverlapsRect(p, PROTOTYPE.radius, wall), false);
});

test('diagonal movement slides along a wall without penetration', () => {
  const wall = { id: 'wall', x: 3, z: 0, width: 1, depth: 10 };
  const p = moveWithCollisions({ x: 1.8, z: -1 }, { x: 2, z: 3 }, [wall]);
  assert.ok(p.x < 2);
  assert.ok(p.z > 1.9);
  assert.equal(circleOverlapsRect(p, PROTOTYPE.radius, wall), false);
});

test('boundary contains the whole character, not just its center', () => {
  const p = moveWithCollisions({ x: 43, z: 0 }, { x: 5, z: 0 }, []);
  assert.ok(p.x <= PROTOTYPE.halfWidth - PROTOTYPE.radius);
});

test('diagonal input is not faster and analog input keeps its strength', () => {
  assert.ok(Math.abs(Math.hypot(...Object.values(normalized(1, 1))) - 1) < 1e-9);
  assert.deepEqual(normalized(0.2, 0.3), { x: 0.2, y: 0.3 });
  assert.deepEqual(normalized(0, 0), { x: 0, y: 0 });
});

test('repeated movement and malformed deltas do not enter solids', () => {
  let p = { ...PROTOTYPE.spawn };
  for (let i = 0; i < 3000; i++) {
    p = moveWithCollisions(p, { x: Math.sin(i * 0.37) * 0.8, z: Math.cos(i * 0.23) * 0.8 });
    assert.ok(canStand(p, PROTOTYPE.radius, SOLIDS));
  }
  assert.deepEqual(moveWithCollisions(p, { x: Number.NaN, z: 0 }), p);
});
