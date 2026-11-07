export type SprintConditions={requested:boolean;forward:number;canAct:boolean;firing:boolean;reloading:boolean;scoped:boolean};
// Movement stays normalized and all displacement still passes through world collision.
export function sprintMultiplier(state:SprintConditions,ratio:number){
 if(!Number.isFinite(ratio)||ratio<1)throw new Error('Invalid sprint multiplier');
 return state.requested&&state.canAct&&state.forward>0&&!state.firing&&!state.reloading&&!state.scoped?ratio:1;
}
