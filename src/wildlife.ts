import {createGear,type GearActor} from './equipment.ts';
import {rayBox, unobstructed, type Vec3} from './combat-geometry.ts';
import type {Doors, Point, World} from './world.ts';

const wildlifeSpecies = [
  {model: 'arctic-fox', name: '북극여우', escapeSpeed: 11, escapeDistance: 23, health: 55, width: .44, height: .76, length: 1.44},
  {model: 'reindeer', name: '순록', escapeSpeed: 12, escapeDistance: 25, health: 85, width: 1.18, height: 2.4, length: 2.13},
  {model: 'polar-bear', name: '북극곰', escapeSpeed: 9.5, escapeDistance: 21, health: 140, width: .82, height: 1.4, length: 2.68},
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
type GroundPoint = Pick<Point,'x'|'z'>;
type Patrol = GroundPoint & {radius:number; angle:number; start:number};
type Flight = {
  from: GroundPoint; to: GroundPoint; start: number; travel: number; resume: number;
  curve?: {control:GroundPoint; yaw:number; entryRate:number; patrol:Patrol};
};
export type Animal = {health:number; respawnAt:number; meat?:Point; flight?:Flight; patrolDelay?:number; patrol?:Patrol};
export const WILDLIFE_SHOT_RANGE = 30;

export function wildlifeMovementRange(speed: number) {
  return speed>16 ? 19 : speed>8.5 ? 12 : 0;
}
export const createWildlife = (saved?: Animal[]): Animal[] =>
  wildlifeSpawns.map(({health},index) => saved?.[index] ?? {health,respawnAt:0});

const angleDifference = (from:number,to:number) => Math.atan2(Math.sin(to-from),Math.cos(to-from));
const ease = (t:number) => t*t*(3-2*t);

function curvedFlightPose(flight:Flight,curve:NonNullable<Flight['curve']>,time:number) {
  const u=Math.max(0,Math.min(1,(time-flight.start)/flight.travel));
  const t=ease(u)+curve.entryRate*u*(1-u)**2;
  const remaining=1-t;
  const {from,to}=flight,{control}=curve;
  const dx=2*(remaining*(control.x-from.x)+t*(to.x-control.x));
  const dz=2*(remaining*(control.z-from.z)+t*(to.z-control.z));
  const heading=Math.atan2(dx,dz),turn=ease(Math.min(1,u*flight.travel/.38));
  const rate=(6*u*(1-u)+curve.entryRate*(1-u)*(1-3*u))/flight.travel;
  return {
    x:remaining**2*from.x+2*remaining*t*control.x+t*t*to.x,
    y:0,
    z:remaining**2*from.z+2*remaining*t*control.z+t*t*to.z,
    yaw:curve.yaw+angleDifference(curve.yaw,heading)*turn,
    speed:Math.hypot(dx,dz)*Math.max(0,rate),
  };
}

export function animalPose(index: number, time: number, animal?: Animal) {
  const flight=animal?.flight;
  if(flight&&time<flight.resume){
    if(flight.curve)return curvedFlightPose(flight,flight.curve,time);
    // Checkpoints from the previous release can still contain an in-progress retreat.
    const elapsed=Math.max(0,time-flight.start),returning=elapsed>=flight.travel+1;
    const progress=returning?Math.max(0,(flight.resume-time)/5):Math.min(1,elapsed/flight.travel);
    const dx=flight.to.x-flight.from.x,dz=flight.to.z-flight.from.z,distance=Math.hypot(dx,dz);
    return {x:flight.from.x+dx*progress,y:0,z:flight.from.z+dz*progress,yaw:Math.atan2(dx,dz)+(returning?Math.PI:0),speed:returning?distance/5:elapsed<flight.travel?distance/flight.travel:0};
  }
  const species=wildlifeSpawns[index]!;
  const patrol=flight?.curve?.patrol??animal?.patrol;
  const delay=(animal?.patrolDelay??0)+(flight&&!flight.curve?flight.resume-flight.start:0);
  const rate=.19-(index%3)*.025;
  const age=Math.max(0,time-(patrol?.start??delay));
  // Gradually rejoin a walk after reaching the end of an escape route.
  const walk=patrol?age-1+Math.exp(-age):age;
  const angle=(patrol?.angle??index*2)+walk*rate;
  const radius=patrol?.radius??2.6;
  return {
    x:(patrol?.x??species.x)+radius*Math.cos(angle),
    y:0,
    z:(patrol?.z??species.z)+radius*Math.sin(angle),
    yaw:-angle,
    speed:radius*rate*(patrol?1-Math.exp(-age):1),
  };
}

function planFlight(from:GroundPoint&{yaw:number;speed:number},source:Point,time:number,species:typeof wildlifeSpawns[number],world:World,solids:ReturnType<World['worldSolids']>): Flight|undefined {
  const dx=from.x-source.x,dz=from.z-source.z;
  const away=Math.hypot(dx,dz)>.01?Math.atan2(dx,dz):from.yaw;
  const clearance=Math.hypot(species.width,species.length)/2;
  const reach=species.escapeDistance+4;
  const nearby=solids.filter(rect=>Math.abs(rect.x-from.x)<=reach+rect.width/2&&Math.abs(rect.z-from.z)<=reach+rect.depth/2);
  const safe=(point:GroundPoint,radius=clearance)=>!world.indoorAt(point)&&world.canStand(point,radius,nearby,false);
  let distance=0,heading=away,score=0;
  for(const turn of [0,.42,-.42,.84,-.84,1.26,-1.26,1.6,-1.6]){
    const direction=away+turn,sine=Math.sin(direction),cosine=Math.cos(direction);
    let clear=0;
    for(let step=.45;step<=species.escapeDistance+.001;step+=.45){
      if(!safe({x:from.x+sine*step,z:from.z+cosine*step}))break;
      clear=step;
    }
    const candidate=clear*Math.cos(turn/2);
    if(candidate>score){distance=clear;heading=direction;score=candidate;}
    if(turn===0&&clear>=species.escapeDistance-.45)break;
  }
  if(distance<1)return;
  const to={x:from.x+Math.sin(heading)*distance,z:from.z+Math.cos(heading)*distance};
  const bend=Math.max(-.31,Math.min(.31,angleDifference(heading,from.yaw)*.6));
  let control={x:from.x+Math.sin(heading+bend)*distance*.5,z:from.z+Math.cos(heading+bend)*distance*.5};
  const samples=Math.ceil(distance/.4);
  for(let i=1;i<samples;i++){
    const t=i/samples,other=1-t;
    if(!safe({x:other**2*from.x+2*other*t*control.x+t*t*to.x,z:other**2*from.z+2*other*t*control.z+t*t*to.z})){
      control={x:(from.x+to.x)/2,z:(from.z+to.z)/2};
      break;
    }
  }
  const arrivalYaw=Math.atan2(to.x-control.x,to.z-control.z);
  const length=Math.hypot(control.x-from.x,control.z-from.z)+Math.hypot(to.x-control.x,to.z-control.z);
  const travel=1.5*length/species.escapeSpeed;
  const entryRate=Math.min(1.5,from.speed*travel/(2*Math.hypot(control.x-from.x,control.z-from.z)));
  const resume=time+travel,angle=-arrivalYaw;
  let patrol:Patrol={...to,radius:0,angle,start:resume};
  for(const radius of [2.6,1.5,.7]){
    const center={x:to.x-radius*Math.cos(angle),z:to.z-radius*Math.sin(angle)};
    if(!safe(center,clearance+radius))continue;
    // The open mouth of a tunnel can be under cover without touching a collider.
    const outdoor=Array.from({length:12},(_,i)=>i*Math.PI/6).every(a=>
      !world.indoorAt({x:center.x+radius*Math.cos(a),z:center.z+radius*Math.sin(a)}));
    if(!outdoor)continue;
    patrol={...center,radius,angle,start:resume};
    break;
  }
  return {from:{x:from.x,z:from.z},to,start:time,travel,resume,curve:{control,yaw:from.yaw,entryRate,patrol}};
}

export function frightenWildlife(animals: Animal[] | undefined,time: number,source: Point,range: number,world: World,doors: Doors,directHit?: number) {
  if(!animals||(!range&&directHit===undefined))return;
  let solids:ReturnType<World['worldSolids']>|undefined;
  for(const [index,animal] of animals.entries()){
    if(animal.health<=0||(!range&&index!==directHit))continue;
    const previous=animal.flight;
    if(previous&&time<previous.start+previous.travel*.72)continue;
    const from=animalPose(index,time,animal);
    if(index!==directHit&&Math.hypot(from.x-source.x,from.z-source.z)>range)continue;
    if(index!==directHit&&!unobstructed(world,doors,{...source,y:(source.y??0)+.8},{...from,y:.55}))continue;
    solids??=world.worldSolids(doors);
    const next=planFlight(from,source,time,wildlifeSpawns[index]!,world,solids);
    if(next)animal.flight=next;
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
      if(animal.flight.curve)animal.patrol=animal.flight.curve.patrol;
      else animal.patrolDelay=(animal.patrolDelay??0)+animal.flight.resume-animal.flight.start;
      delete animal.flight;
    }
    if (animal.health > 0 || time < animal.respawnAt) continue;
    animal.health = wildlifeSpawns[index]!.health;
    animal.respawnAt = 0;
    delete animal.meat;
    delete animal.flight;
    delete animal.patrolDelay;
    delete animal.patrol;
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
