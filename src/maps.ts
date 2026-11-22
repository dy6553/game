export const MAPS={
 harbor:{name:'항구 지구',description:'도심 골목과 옥상을 오가는 야간 전투',level:1},
 factory:{name:'폐공장',description:'다층 공장과 산업 엄폐물',level:3},
 snow:{name:'설원 연구소',description:'이글루 관측소와 아치 연구동 · 주기적 폭설',level:3},
 moon:{name:'달 기지',description:'크레이터와 착륙장 · 외곽 산소 쉼터',level:3},
} as const;
export type MapId=keyof typeof MAPS;
export type ExpansionMapId='snow'|'moon';
export function normalizeMap(value:unknown):MapId{return typeof value==='string'&&Object.hasOwn(MAPS,value)?value as MapId:'harbor';}
export function isExpansionMap(value:unknown):value is ExpansionMapId{return value==='snow'||value==='moon';}
export function canAccessMap(_value:unknown,_loggedIn:boolean,_level:number){return true;}
