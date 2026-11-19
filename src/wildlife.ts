import {createGear,type GearActor} from './equipment.ts';
import {rayBox, unobstructed, type Vec3} from './combat-geometry.ts';
import type {Doors, Point, World} from './world.ts';

const wildlifeSpecies = [
  {model: 'arctic-fox', name: '북극여우', health: 55, width: .44, height: .76, length: 1.44},
  {model: 'reindeer', name: '순록', health: 85, width: 1.18, height: 2.4, length: 2.13},
  {model: 'polar-bear', name: '북극곰', health: 140, width: .82, height: 1.4, length: 2.68},
] as const;

// Keep the original three slots first so existing saved health and meat stay with their species.
export const wildlifeSpawns = [
  {...wildlifeSpecies[0],x:-22,z:-28},
  {...wildlifeSpecies[1],x:22,z:-27},
  {...wildlifeSpecies[2],x:0,z:25},
  {...wildlifeSpecies[0],x:-8,z:-25},
  {...wildlifeSpecies[1],x:8,z:-25},
  {...wildlifeSpecies[2],x:8,z:25},
  {...wildlifeSpecies[0],x:-47,z:-14},
  {...wildlifeSpecies[1],x:46,z:23},
  {...wildlifeSpecies[2],x:-48,z:20},
  {...wildlifeSpecies[0],x:-10,z:39},
  {...wildlifeSpecies[1],x:14,z:45},
  {...wildlifeSpecies[2],x:9,z:-41},
] as const;

const healAmount = 25;
const respawnSeconds = 30;
type Flight = {from: Point; to: Point; start: number; travel: number; resume: number};
export type Animal = {health: number; respawnAt: number; meat?: Point; flight?: Flight; patrolDelay?: number};
const flightRecovery = 5;
export const WILDLIFE_SHOT_RANGE = 30;
export function wildlifeMovementRange(speed: number) {
  return speed>16 ? 19 : speed>8.5 ? 12 : 0;
}
export const createWildlife = (saved?: Animal[]): Animal[] =>
  wildlifeSpawns.map(({health},index) => saved?.[index] ?? {health,respawnAt:0});

export function animalPose(index: number, time: number, animal?: Animal) {
  const flight = animal?.flight;
  if(flight && time < flight.resume){
    const elapsed=Math.max(0,time-flight.start),returning=elapsed>=flight.travel+1;
    const progress=returning?Math.max(0,(flight.resume-time)/flightRecovery):Math.min(1,elapsed/flight.travel);
    const dx=flight.to.x-flight.from.x,dz=flight.to.z-flight.from.z;
    return {x:flight.from.x+dx*progress,y:0,z:flight.from.z+dz*progress,yaw:Math.atan2(dx,dz)+(returning?Math.PI:0)};
  }
  const species = wildlifeSpawns[index]!;
  const patrolTime=time-(animal?.patrolDelay??0)-(flight?flight.resume-flight.start:0);
  const angle = patrolTime * (.19 - (index % 3) * .025) + index * 2;
  return {x: species.x + 2.6 * Math.cos(angle), y: 0, z: species.z + 2.6 * Math.sin(angle), yaw: -angle};
}

export function frightenWildlife(animals: Animal[] | undefined,time: number,source: Point,range: number,world: World,doors: Doors,directHit?: number) {
  if(!animals||(!range&&directHit===undefined))return;
  let solids: ReturnType<World['worldSolids']>|undefined;
  for(const [index,animal] of animals.entries()){
    if(animal.health<=0||animal.flight)continue;
    const from=animalPose(index,time,animal);
    const dx=from.x-source.x,dz=from.z-source.z;
    if(index!==directHit&&Math.hypot(dx,dz)>range)continue;
    if(index!==directHit&&!unobstructed(world,doors,{...source,y:(source.y??0)+.8},{...from,y:.55}))continue;
    const away=Math.hypot(dx,dz)>.01?Math.atan2(dx,dz):from.yaw;
    solids??=world.worldSolids(doors);
    const species=wildlifeSpawns[index]!;
    const clearance=Math.hypot(species.width,species.length)/2;
    let to=from,distance=0;
    for(const turn of [0,.45,-.45,.9,-.9,1.35,-1.35]){
      const sx=Math.sin(away+turn),sz=Math.cos(away+turn);
      for(let step=.5;step<=10;step+=.5){
        const next={x:from.x+sx*step,y:0,z:from.z+sz*step,yaw:away+turn};
        if(world.indoorAt(next)||!world.canStand(next,clearance,solids))break;
        if(step>distance){to=next;distance=step;}
      }
      if(distance===10)break;
    }
    if(distance>=1){
      const travel=distance/9;
      animal.flight={from,to,start:time,travel,resume:time+travel+1+flightRecovery};
    }
  }
}

export function wildlifeHit(animals: Animal[], time: number, origin: Vec3, direction: Vec3, limit: number) {
  let nearest: {index: number; distance: number} | undefined;
  for (const [index, animal] of animals.entries()) {
    if (animal.health <= 0) continue;
    const {x,z,yaw} = animalPose(index,time,animal);
    const {width,height,length} = wildlifeSpawns[index]!;
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
    const {x,z} = animalPose(index,time,animal);
    animal.meat = {x,z,y:0};
  }
  return before-animal.health;
}

export function advanceWildlife(animals: Animal[],time: number) {
  for (const [index,animal] of animals.entries()) {
    if(animal.flight&&time>=animal.flight.resume){
      animal.patrolDelay=(animal.patrolDelay??0)+animal.flight.resume-animal.flight.start;
      delete animal.flight;
    }
    if (animal.health > 0 || time < animal.respawnAt) continue;
    animal.health = wildlifeSpawns[index]!.health;
    animal.respawnAt = 0;
    delete animal.meat;
    delete animal.flight;
    delete animal.patrolDelay;
  }
}

export const MEAT_CAPACITY = 3;

export function nearbyMeat(animals: Animal[] | undefined, player: Point, world: World, doors: Doors, id?: string) {
  if (!animals) return;
  for (const [index,animal] of animals.entries()) {
    const meat = animal.meat;
    if (!meat) continue;
    const dropId = `meat-${index}-${animal.respawnAt}`;
    if (id !== undefined && id !== dropId) continue;
    if (Math.hypot(player.x-meat.x,player.z-meat.z,(player.y ?? 0)-(meat.y ?? 0))>1.4) continue;
    if (!unobstructed(world,doors,{...player,y:(player.y ?? 0)+.35},{x:meat.x,y:(meat.y ?? 0)+.35,z:meat.z})) continue;
    return {id:dropId,animal};
  }
}

export function takeMeat(animals: Animal[] | undefined, player: Point, count: number, world: World, doors: Doors, id: string) {
  if (count >= MEAT_CAPACITY) return false;
  const drop = nearbyMeat(animals,player,world,doors,id);
  if (!drop) return false;
  delete drop.animal.meat;
  return true;
}

export function meatRecovery(count: number, health: number) {
  return count>0 && health>0 ? Math.max(0,Math.min(healAmount,100-health)) : 0;
}

export function wildlifeBlastTargets(animals: Animal[] | undefined,time: number): GearActor[] {
  return animals?.flatMap((animal,index)=>animal.health>0?[{
    ...animalPose(index,time,animal),id:'wildlife-'+index,health:animal.health,pitch:0,
    gear:createGear(),healing:0,flash:0,gearCooldown:0,wildlifeBounds:wildlifeSpawns[index]!,
  }]:[])??[];
}
