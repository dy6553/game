// Bound long stalls for every game rule equally; ordinary 10 FPS frames retain all time.
export function simulationSteps(elapsed: number): number[] {
  if (!Number.isFinite(elapsed) || elapsed <= 0) return [];
  const duration = Math.min(elapsed, 0.25);
  const count = Math.ceil(duration / 0.025);
  return Array<number>(count).fill(duration / count);
}
