import { normalized } from './world.ts';

export type Look = { yaw: number; pitch: number };
export function turnView(look: Look, dx: number, dy: number, sensitivity = 0.004): Look {
  if (![dx, dy].every(Number.isFinite)) return { ...look };
  return {
    yaw: Math.atan2(Math.sin(look.yaw + dx * sensitivity), Math.cos(look.yaw + dx * sensitivity)),
    pitch: Math.max(-1.2, Math.min(1.2, look.pitch + dy * sensitivity)),
  };
}
export function viewMovement(yaw: number, x: number, y: number) {
  const input = normalized(x, y);
  // Movement uses horizontal yaw only; looking up never makes the player fly.
  return { x: Math.cos(yaw) * input.x + Math.sin(yaw) * input.y,
    z: -Math.sin(yaw) * input.x + Math.cos(yaw) * input.y };
}
