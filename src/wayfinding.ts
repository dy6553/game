import type {World,Point} from './world.ts';
import {moonCovered,moonExteriorAirlocks,moonAirlocks} from './moon-layout.ts';
export type BuildingLandmark={id:string;code:string;name:string;color:string};
const cache=new WeakMap<World,readonly BuildingLandmark[]>();
export function buildingLandmarks(world:World):readonly BuildingLandmark[]{
 let result=cache.get(world);if(result)return result;
 const snow=world.BUILDINGS[0]?.id==='Research hub',lunar=world.BUILDINGS[0]?.id.startsWith('Habitat'),factory=world.BUILDINGS[0]?.id.startsWith('factory');
 result=world.BUILDINGS.filter(b=>b.enterable).map((b,i)=>({id:b.id,code:(snow?'S':lunar?'L':factory?'F':'A')+(i+1),name:snow?(i===0?'중앙 이글루':`아치 연구동 ${i}`):lunar?(i===0?'거주 돔':i===1?'운영·통신동':`산소 쉼터 ${i-1}`):factory?`${b.z<0?'남':'북'}${b.x<0?'서':'동'} 생산동`:b.z< -28?`${b.x<0?'서':'동'} 물류동`:`${b.z<0?'남':'북'}${b.x<0?'서':'동'} 상가`,color:b.id.startsWith('moon-shelter-')?'#69f1d4':b.z< -28?'#e7bc78':b.x<0?'#79cbbd':'#8ab9ef'}));
 cache.set(world,result);return result;
}
export function navigationLocation(world:World,point:Point){
 const level=point.y??0;
 const lunar=world.BUILDINGS[0]?.id.startsWith('Habitat');
 const building=world.indoorAt(point)??(lunar?undefined:world.BUILDINGS.find(b=>{if(!b.enterable)return false;return [world.SECOND_FLOOR,b.height].some(y=>{if(Math.abs(level-y)>.2)return false;const deck=world.balcony(b,y);return Math.abs(point.x-deck.x)<=deck.width/2&&Math.abs(point.z-deck.z)<=deck.depth/2;});}));
 if(building){const l=buildingLandmarks(world).find(l=>l.id===building.id)!;const floor=level>=building.height-.15?'RF':level>=world.SECOND_FLOOR-.15?'2F':'1F';const onStairs=level>.2&&Math.abs(level-world.SECOND_FLOOR)>.2&&level<building.height-.2;const detail=onStairs?(level<world.SECOND_FLOOR?'1F → 2F':'2F → RF'):floor==='RF'?'옥상':floor==='2F'?'2층':'1층';return {...l,floor,label:`${l.code} · ${l.name} · ${detail}`};}
 const name=world.BUILDINGS[0]?.id==='Research hub'?'설원 탐사로':lunar?(moonCovered(point)?'달 기지 · 연결 통로':'달 기지 탐사 구역'):world.BUILDINGS[0]?.id.startsWith('factory')?'공장 중앙 통로':point.z< -28?'남쪽 물류 거리':point.z>28?'항구 산책로':Math.abs(point.x)>40?'외곽 골목':Math.abs(point.x)<11&&Math.abs(point.z)<11?'중앙 광장':'상가 연결로';
 return {id:'',code:'',name,color:'#d4ded8',floor:'G',label:name};
}

export function oxygenGuidance(world:World,me:Point,yaw:number,oxygen:number){
 if(oxygen>20||world.BUILDINGS[0]?.id!=='Habitat west'||world.hasLunarOxygen(me))return;
 const landmarks=buildingLandmarks(world);
 const entries=[
  ...moonExteriorAirlocks.map(door=>({x:door.x,z:door.z,name:landmarks.find(room=>door.id.startsWith(room.id+' exterior hatch'))!.name})),
  ...moonAirlocks.filter(door=>door.id.startsWith('moon-crossing-airlock-')).map(door=>({x:door.x,z:door.z,name:'연결 통로'})),
 ];
 let closest:({x:number;z:number;name:string;distance:number;angle:number})|undefined;
 for(const entry of entries){
  const dx=entry.x-me.x,dz=entry.z-me.z,distance=Math.hypot(dx,dz);
  const relative=Math.atan2(dx,dz)-yaw,angle=Math.atan2(Math.sin(relative),Math.cos(relative));
  if(!closest||distance<closest.distance||(distance===closest.distance&&Math.abs(angle)<Math.abs(closest.angle))){
   closest={...entry,distance,angle};
  }
 }
 if(!closest)return;
 const directions=['앞','오른쪽 앞','오른쪽','오른쪽 뒤','뒤','왼쪽 뒤','왼쪽','왼쪽 앞'];
 const direction=directions[(Math.round(closest.angle/(Math.PI/4))+8)%8]!;
 return {...closest,distance:Math.ceil(closest.distance),direction};
}
