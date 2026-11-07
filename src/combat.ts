// Approved pistol target-practice values; other weapons and match rules stay separate.
export const PRACTICE_RULES:Readonly<CombatRules>=Object.freeze({maxHealth:100,damage:25,magazineSize:12,reloadSeconds:1.5});
export type CombatRules = {
  maxHealth:number;
  damage:number;
  magazineSize:number;
  reloadSeconds:number;
};
export type WeaponState = { ammo:number; reloadRemaining:number };
export function validateCombatRules(rules:CombatRules) {
  if(!Number.isFinite(rules.maxHealth)||rules.maxHealth<=0
    ||!Number.isFinite(rules.damage)||rules.damage<=0
    ||!Number.isInteger(rules.magazineSize)||rules.magazineSize<=0
    ||!Number.isFinite(rules.reloadSeconds)||rules.reloadSeconds<=0) {
    throw new Error('전투 규칙의 체력·피해·탄창·재장전 값이 올바르지 않습니다.');
  }
}
export function createWeapon(rules:CombatRules):WeaponState {
  validateCombatRules(rules);return {ammo:rules.magazineSize,reloadRemaining:0};
}
export function tryFire(state:WeaponState):{state:WeaponState;fired:boolean;reason:'fired'|'empty'|'reloading'} {
  if(state.reloadRemaining>0)return {state,fired:false,reason:'reloading'};
  if(state.ammo<=0)return {state,fired:false,reason:'empty'};
  return {state:{...state,ammo:state.ammo-1},fired:true,reason:'fired'};
}
export function beginReload(state:WeaponState,rules:CombatRules):WeaponState {
  if(state.reloadRemaining>0||state.ammo>=rules.magazineSize)return state;
  return {...state,reloadRemaining:rules.reloadSeconds};
}
export function advanceWeapon(state:WeaponState,elapsed:number,rules:CombatRules):WeaponState {
  if(!Number.isFinite(elapsed)||elapsed<0)throw new Error('경과 시간은 0 이상의 유한한 값이어야 합니다.');
  if(state.reloadRemaining<=0)return state;
  const remaining=Math.max(0,state.reloadRemaining-elapsed);
  return remaining<1e-9?{ammo:rules.magazineSize,reloadRemaining:0}:{...state,reloadRemaining:remaining};
}
export function applyDamage(health:number,damage:number) {
  if(!Number.isFinite(health)||health<0||!Number.isFinite(damage)||damage<0)throw new Error('체력과 피해 값이 올바르지 않습니다.');
  const remaining=Math.max(0,health-damage);
  return {health:remaining,eliminated:health>0&&remaining===0};
}
