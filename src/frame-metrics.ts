export function createFrameMetrics() {
  let frames: number[] = [], duration = 0;
  return {
    reset() { frames = []; duration = 0; },
    sample(dt: number) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      frames.push(dt); duration += dt;
      while (duration > 10 && frames.length > 1) duration -= frames.shift()!;
    },
    read() {
      const sorted = [...frames].sort((a, b) => a - b);
      return { fps: duration ? frames.length / duration : 0,
        p95Ms: (sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)] ?? 0) * 1000,
        stalls: frames.filter(dt => dt > .05).length, seconds: duration };
    },
  };
}
