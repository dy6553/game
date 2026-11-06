export type Point = { x: number; z: number };
export type Rect = { id: string; x: number; z: number; width: number; depth: number };
export type Building = Rect & { height: number; palette: number };

// Exploration values only; these are not final combat balance or map dimensions.
export const PROTOTYPE = {
  halfWidth: 44, halfDepth: 34, radius: 0.55, speed: 7,
  spawn: { x: 0, z: -8 },
};

export const BUILDINGS: Building[] = [-19, 19].flatMap((z, row) =>
  [-33, -17, 17, 33].map((x, column) => ({
    id: `building-${row}-${column}`, x, z,
    width: column === 0 || column === 3 ? 11 : 12,
    depth: 13, height: 7 + ((row + column) % 3) * 1.5,
    palette: (row + column) % 3,
  })),
);

export const COVERS: Rect[] = [
  { id: 'planter-west', x: -7.8, z: -5, width: 3.8, depth: 1.8 },
  { id: 'planter-east', x: 7.8, z: 5, width: 3.8, depth: 1.8 },
  { id: 'planter-north', x: -7.8, z: 7.5, width: 3.8, depth: 1.8 },
  { id: 'van', x: 6.8, z: -7, width: 2.6, depth: 5 },
];
export const SOLIDS: Rect[] = [...BUILDINGS, ...COVERS];

export function circleOverlapsRect(p: Point, radius: number, rect: Rect): boolean {
  const nx = Math.max(rect.x - rect.width / 2, Math.min(p.x, rect.x + rect.width / 2));
  const nz = Math.max(rect.z - rect.depth / 2, Math.min(p.z, rect.z + rect.depth / 2));
  return (p.x - nx) ** 2 + (p.z - nz) ** 2 < radius ** 2 - 1e-8;
}

export function canStand(p: Point, radius: number, solids: readonly Rect[] = SOLIDS): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.z)
    && Math.abs(p.x) <= PROTOTYPE.halfWidth - radius
    && Math.abs(p.z) <= PROTOTYPE.halfDepth - radius
    && !solids.some(rect => circleOverlapsRect(p, radius, rect));
}

export function moveWithCollisions(
  position: Point, delta: Point, solids: readonly Rect[] = SOLIDS,
  radius = PROTOTYPE.radius,
): Point {
  if (![delta.x, delta.z, position.x, position.z].every(Number.isFinite)) return { ...position };
  // Substeps prevent tunneling on slow frames; axes separated to slide along walls.
  const distance = Math.hypot(delta.x, delta.z);
  const safeDistance = Math.min(distance, 5);
  const scale = distance > 0 ? safeDistance / distance : 0;
  const steps = Math.max(1, Math.ceil(safeDistance / (radius * 0.45)));
  const dx = delta.x * scale / steps, dz = delta.z * scale / steps;
  let p = { ...position };
  for (let i = 0; i < steps; i++) {
    const nextX = { x: p.x + dx, z: p.z };
    if (canStand(nextX, radius, solids)) p = nextX;
    const nextZ = { x: p.x, z: p.z + dz };
    if (canStand(nextZ, radius, solids)) p = nextZ;
  }
  return p;
}

export function normalized(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}
