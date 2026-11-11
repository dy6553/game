import type {World,Point} from './world.ts';
export type BuildingLandmark={id:string;code:string;name:string;color:string};
const cache=new WeakMap<World,readonly BuildingLandmark[]>();
export function buildingLandmarks(world:World):readonly BuildingLandmark[]{
 let result=cache.get(world);if(result)return result;
 const factory=world.BUILDINGS[0]?.id.startsWith('factory');
 result=world.BUILDINGS.filter(b=>b.enterable).map((b,i)=>({id:b.id,code:(factory?'F':'A')+(i+1),name:factory?`${b.z<0?'남':'북'}${b.x<0?'서':'동'} 생산동`:b.z< -28?`${b.x<0?'서':'동'} 물류동`:`${b.z<0?'남':'북'}${b.x<0?'서':'동'} 상가`,color:b.z< -28?'#e7bc78':b.x<0?'#79cbbd':'#8ab9ef'}));
 cache.set(world,result);return result;
}
export function navigationLocation(world:World,point:Point){
 const level=point.y??0;
 const building=world.indoorAt(point)??world.BUILDINGS.find(b=>{if(!b.enterable)return false;return [world.SECOND_FLOOR,b.height].some(y=>{if(Math.abs(level-y)>.2)return false;const deck=world.balcony(b,y);return Math.abs(point.x-deck.x)<=deck.width/2&&Math.abs(point.z-deck.z)<=deck.depth/2;});});
 if(building){const l=buildingLandmarks(world).find(l=>l.id===building.id)!;const floor=level>=building.height-.15?'RF':level>=world.SECOND_FLOOR-.15?'2F':'1F';const onStairs=level>.2&&Math.abs(level-world.SECOND_FLOOR)>.2&&level<building.height-.2;const detail=onStairs?(level<world.SECOND_FLOOR?'1F → 2F':'2F → RF'):floor==='RF'?'옥상':floor==='2F'?'2층':'1층';return {...l,floor,label:`${l.code} · ${l.name} · ${detail}`};}
 const name=world.BUILDINGS[0]?.id.startsWith('factory')?'공장 중앙 통로':point.z< -28?'남쪽 물류 거리':point.z>28?'항구 산책로':Math.abs(point.x)>40?'외곽 골목':Math.abs(point.x)<11&&Math.abs(point.z)<11?'중앙 광장':'상가 연결로';
 return {id:'',code:'',name,color:'#d4ded8',floor:'G',label:name};
}
