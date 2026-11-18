import {createGear,type GearActor} from './equipment.ts';
import {rayBox, unobstructed, type Vec3} from './combat-geometry.ts';
import type {Doors, Point, World} from './world.ts';

export const wildlifeSpecies = [
  {model: 'arctic-fox', x: -22, z: -28, health: 55, width: .44, height: .76, length: 1.44},
  {model: 'reindeer', x: 22, z: -27, health: 85, width: 1.18, height: 2.4, length: 2.13},
  {model: 'polar-bear', x: 0, z: 25, health: 140, width: .82, height: 1.4, length: 2.68},
] as const;

const healAmount = 25;
const respawnSeconds = 30;
export type Animal = {health: number; respawnAt: number; meat?: Point};
export const createWildlife = (): Animal[] => wildlifeSpecies.map(({health}) => ({health, respawnAt: 0}));

export function animalPose(index: number, time: number) {
  const species = wildlifeSpecies[index]!;
  const angle = time * (.19 - index * .025) + index * 2;
  return {x: species.x + 2.6 * Math.cos(angle), y: 0, z: species.z + 2.6 * Math.sin(angle), yaw: -angle};
}

export function wildlifeHit(animals: Animal[], time: number, origin: Vec3, direction: Vec3, limit: number) {
  let nearest: {index: number; distance: number} | undefined;
  for (const [index, animal] of animals.entries()) {
    if (animal.health <= 0) continue;
    const {x,z,yaw} = animalPose(index,time);
    const {width,height,length} = wildlifeSpecies[index]!;
    const sine = Math.sin(yaw), cosine = Math.cos(yaw);
    const dx = origin.x-x, dz = origin.z-z;
    const distance = rayBox(
      [dx*cosine-dz*sine,origin.y,dx*sine+dz*cosine],
      [direction.x*cosine-direction.z*sine,direction.y,direction.x*sine+direction.z*cosine],
      [-width/2,0,-length/2],[width/2,height,length/2],limit,
    );
    if (distance < (nearest?.distance ?? limit)) nearest = {index,distance};
  }
  return nearest;
}

export function hurtWildlife(animals: Animal[], index: number, amount: number, time: number) {
  const animal = animals[index]!;
  const before = animal.health;
  if (before <= 0) return 0;
  animal.health = Math.max(0,before-amount);
  if (animal.health === 0) {
    animal.respawnAt = time + respawnSeconds;
    const {x,z} = animalPose(index,time);
    animal.meat = {x,z,y:0};
  }
  return before-animal.health;
}

export function advanceWildlife(animals: Animal[],time: number) {
  for (const [index,animal] of animals.entries()) {
    if (animal.health > 0 || time < animal.respawnAt) continue;
    animal.health = wildlifeSpecies[index]!.health;
    animal.respawnAt = 0;
    delete animal.meat;
  }
}

export function collectMeat(animals: Animal[], player: Point, health: number, world: World, doors: Doors) {
  if (health <= 0 || health >= 100) return 0;
  for (const animal of animals) {
    const meat = animal.meat;
    if (!meat || Math.hypot(player.x-meat.x,player.z-meat.z,player.y ?? 0)>1.4) continue;
    if (!unobstructed(world,doors,{...player,y:(player.y ?? 0)+.35},{x:meat.x,y:.35,z:meat.z})) continue;
    delete animal.meat;
    return Math.min(healAmount,100-health);
  }
  return 0;
}

export function wildlifeBlastTargets(animals: Animal[] | undefined,time: number): GearActor[] {
  return animals?.flatMap((animal,index)=>animal.health>0?[{
    ...animalPose(index,time),id:'wildlife-'+index,health:animal.health,pitch:0,
    gear:createGear(),healing:0,flash:0,gearCooldown:0,wildlifeBounds:wildlifeSpecies[index]!,
  }]:[])??[];
}
