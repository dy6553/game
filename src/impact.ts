import type { WeaponId } from './weapons.ts';

// Presentation only: never changes input aim, damage, ammo or combat timers.
export const RECOIL = Object.freeze({
  pistol: { kick: .72, recovery: 17, tilt: .11, push: .075 },
  machinegun: { kick: .27, recovery: 22, tilt: .055, push: .045 },
  shotgun: { kick: 1.15, recovery: 10, tilt: .16, push: .12 },
  smg:{kick:.18,recovery:25,tilt:.045,push:.035},
  burst:{kick:.34,recovery:19,tilt:.065,push:.055},
  quad:{kick:.3,recovery:20,tilt:.06,push:.05},
  bazooka:{kick:1.1,recovery:9,tilt:.13,push:.12},
  dmr:{kick:.95,recovery:12,tilt:.12,push:.1},
  sniper: { kick: 1.3, recovery: 8, tilt: .14, push: .14 },
});
export type ShakeLevel = 'off' | 'low' | 'normal';
export function createRecoil() {
  let kick=0,age=0,profile=RECOIL.pistol;
  let level:ShakeLevel='low';
  return {
    fire(id:WeaponId) { profile=RECOIL[id];kick=Math.min(1.6,kick+profile.kick);age=0; },
    update(dt:number) { if(Number.isFinite(dt)&&dt>0){age+=dt;kick*=Math.exp(-profile.recovery*dt);if(kick<.001)kick=0;} },
    clear() {kick=0;age=0;},
    setShake(value:ShakeLevel) {level=value;},
    read() {
      const strength=level==='off'?0:level==='low'?.4:1;
      return { kick, tilt:kick*profile.tilt, push:kick*profile.push,
        roll:Math.sin(age*75)*kick*.004*strength, fov:kick*.008*strength };
    },
  };
}
