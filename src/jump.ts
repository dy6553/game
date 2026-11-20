export type JumpState={height:number;velocity:number};
// Prototype motion tuning, separate from final online movement/balance.
export const JUMP_TUNING={gravity:18,launchSpeed:6};
export function createJump():JumpState{return {height:0,velocity:0};}
export function beginJump(state:JumpState,launchSpeed=JUMP_TUNING.launchSpeed):JumpState{
  if(state.height>0||state.velocity!==0)return state;
  return {height:0,velocity:launchSpeed};
}
export function advanceJump(state:JumpState,elapsed:number,gravity=JUMP_TUNING.gravity):JumpState{
  if(!Number.isFinite(elapsed)||elapsed<0)throw new Error('점프 경과 시간이 올바르지 않습니다.');
  if(state.height===0&&state.velocity===0)return state;
  const height=state.height+state.velocity*elapsed-0.5*gravity*elapsed**2;
  const velocity=state.velocity-gravity*elapsed;
  return height<=0&&velocity<0?createJump():{height:Math.max(0,height),velocity};
}
