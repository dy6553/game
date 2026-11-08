import type {createAccount} from './account.ts';
import type {Growth} from './progression.ts';
export const ADMIN_MARKUP=`<section id="account-admin" hidden aria-label="관리자 레벨 편집"><form id="admin-find-form"><label>찾을 계정 이메일<input id="admin-email" type="email" autocomplete="off" required maxlength="254"></label><button id="admin-find" type="submit">계정 찾기</button></form><p id="admin-target-summary"></p><form id="admin-level-form" hidden><label>변경할 레벨<input id="admin-level" type="number" min="1" step="1" required></label><label>변경 사유 · 선택<input id="admin-reason" maxlength="200" autocomplete="off"></label><p>지정한 레벨의 시작 경험치로 변경합니다. 레벨을 내리면 해금 조건도 다시 적용됩니다.</p><button id="admin-save" type="submit">레벨 저장</button></form><p id="admin-status" role="status"></p><h3 id="admin-history-title" hidden>최근 레벨 변경 · 최대 10건</h3><ol id="admin-history"></ol><button id="admin-back" type="button">내 계정으로 돌아가기</button></section>`;
type Target={id:string;growth:Growth;history:{beforeXP:number;afterXP:number;reason:string;changedAt:number}[]};
type Edit={id:string;requestId:string;level:number;expectedXP:number;reason:string};
export function createAdminView(getAccount:()=>Promise<ReturnType<typeof createAccount>|null>,actions:{open():boolean;back():void;updated(g:Growth):void;denied():void}){
 const el=(id:string)=>document.getElementById(id)!;
 const panel=el('account-admin'),entry=el('account-admin-open');
 let allowed=false,busy=false,version=0,target:Target|null=null,pending:Edit|null=null;
 function controls(){for(const node of panel.querySelectorAll<HTMLInputElement|HTMLButtonElement>('input,button'))node.disabled=busy;el('admin-save').toggleAttribute('disabled',busy||!target);}
 function reset(){version++;busy=false;target=null;pending=null;panel.hidden=true;(el('admin-email') as HTMLInputElement).value='';(el('admin-level') as HTMLInputElement).value='';(el('admin-reason') as HTMLInputElement).value='';el('admin-status').textContent='';el('admin-target-summary').textContent='';el('admin-history').replaceChildren();el('admin-history-title').hidden=true;el('admin-level-form').hidden=true;controls();}
 function render(data:Target){target=data;pending=null;el('admin-level-form').hidden=false;el('admin-target-summary').textContent=`대원 ID · ${data.id} · Lv${data.growth.level} · ${data.growth.xp.toLocaleString('ko-KR')} XP`;(el('admin-level') as HTMLInputElement).value=String(data.growth.level);(el('admin-reason') as HTMLInputElement).value='';const list=el('admin-history');list.replaceChildren();el('admin-history-title').hidden=!data.history.length;for(const h of data.history){const li=document.createElement('li');li.textContent=`${new Date(h.changedAt).toLocaleString('ko-KR')} · ${h.beforeXP} → ${h.afterXP} XP${h.reason?' · '+h.reason:''}`;list.append(li);}}
 async function run(action:(account:ReturnType<typeof createAccount>,ticket:number)=>Promise<void>){if(busy||!allowed)return;busy=true;controls();const ticket=version;el('admin-status').textContent='처리 중…';
  try{const account=await getAccount();if(!account)throw Error('로그인이 필요합니다.');await action(account,ticket);}
  catch(error){if(ticket!==version)return;el('admin-status').textContent=error instanceof Error?error.message:'요청을 완료하지 못했습니다.';
   if((error as {status?:number})?.status===409){target=null;pending=null;el('admin-level-form').hidden=true;}
   if((error as {status?:number})?.status===403){allowed=false;entry.hidden=true;reset();actions.denied();}
  }finally{if(ticket===version){busy=false;controls();}}
 }
 entry.addEventListener('click',()=>{if(!allowed||!actions.open())return;reset();panel.hidden=false;el('admin-email').focus();});
 el('admin-back').addEventListener('click',()=>{reset();actions.back();});
 el('admin-email').addEventListener('input',()=>{if(busy)return;target=null;pending=null;el('admin-level-form').hidden=true;el('admin-target-summary').textContent='';el('admin-history').replaceChildren();el('admin-history-title').hidden=true;controls();});
 el('admin-find-form').addEventListener('submit',event=>{event.preventDefault();const email=(el('admin-email') as HTMLInputElement).value.trim();target=null;pending=null;el('admin-level-form').hidden=true;el('admin-target-summary').textContent='';el('admin-history').replaceChildren();el('admin-history-title').hidden=true;void run(async(a,ticket)=>{const data=await a.adminRequest('/admin/players/find',{email}) as Target;if(ticket!==version)return;render(data);el('admin-status').textContent='계정을 찾았습니다. 변경할 레벨을 입력하세요.';});});
 el('admin-level-form').addEventListener('submit',event=>{event.preventDefault();if(!target)return;const selected=target,level=Number((el('admin-level') as HTMLInputElement).value),reason=(el('admin-reason') as HTMLInputElement).value.trim();if(!Number.isSafeInteger(level)||level<1||!Number.isSafeInteger((level-1)*200)){el('admin-status').textContent='레벨은 1 이상의 유효한 정수로 입력하세요.';return;}
  if(!pending||pending.id!==selected.id||pending.level!==level||pending.expectedXP!==selected.growth.xp||pending.reason!==reason)pending={id:selected.id,level,expectedXP:selected.growth.xp,reason,requestId:crypto.randomUUID()};const body=pending;
  void run(async(a,ticket)=>{const data=await a.adminRequest('/admin/players/level',body) as Target;if(ticket!==version)return;render(data);if(a.profile?.id===data.id){a.profile.growth=data.growth;actions.updated(data.growth);}el('admin-status').textContent=`서버 저장 완료 · Lv${data.growth.level}`;});
 });
 return {reset,setAllowed(value:boolean){allowed=value;entry.hidden=!value;if(!value)reset();}};
}
