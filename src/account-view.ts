import {normalizeNickname} from './nickname.ts';
import {ADMIN_MARKUP,createAdminView} from './admin-view.ts';
import {connectAccount,type OfficialProfile} from './account.ts';
import {growth,type Growth} from './progression.ts';
import type {MatchResult} from './results.ts';
export const ACCOUNT_MARKUP=`<section id="account-panel" class="account-panel" role="dialog" aria-modal="true" aria-labelledby="account-title" hidden><div class="account-card"><span class="eyebrow">HARBOR / PLAYER PROFILE</span><h2 id="account-title">계정 · 공식 전적</h2><p id="account-description">로그인 없이도 모든 게임 모드를 플레이할 수 있습니다. 로그인한 온라인 경기만 공식 전적으로 저장됩니다. 전적용 ID와 성적은 다른 사람도 볼 수 있으며 이메일은 공개하지 않습니다.</p><form id="account-form"><label>이메일<input id="account-email" type="email" autocomplete="email" required maxlength="254"></label><label>비밀번호<input id="account-password" type="password" autocomplete="current-password" minlength="8" maxlength="128" required></label><div class="account-actions"><button id="account-signin" type="submit">로그인</button><button id="account-signup" type="button">회원가입</button></div></form><form id="account-signup-form" hidden><label>닉네임<input id="signup-nickname" autocomplete="nickname" required minlength="2" maxlength="16" placeholder="게임에 표시할 이름"></label><label>이메일<input id="signup-email" type="email" autocomplete="email" required maxlength="254"></label><label>비밀번호<input id="signup-password" type="password" autocomplete="new-password" required minlength="8" maxlength="128" aria-describedby="signup-password-hint"></label><p id="signup-password-hint">비밀번호는 8~128자로 입력하세요.</p><div class="account-actions"><button id="account-signup-submit" type="submit">가입하기</button><button id="account-signup-back" type="button">로그인으로 돌아가기</button></div></form><div id="account-profile" hidden><h3 id="account-nickname"></h3><form id="nickname-edit-form"><label>닉네임<input id="profile-nickname" autocomplete="nickname" minlength="2" maxlength="16" required></label><button type="submit">닉네임 저장</button></form><p id="account-public-id"></p><p id="account-summary"></p><ol id="account-recent"></ol><button id="account-share">공개 전적 링크 복사</button><button id="account-refresh">전적 새로고침</button><button id="account-admin-open" hidden>관리자 · 레벨 편집</button><button id="account-signout">로그아웃</button><details><summary>계정 삭제</summary><p>계정과 공식 전적·누적 승패·성장 기록을 함께 삭제합니다. 이 작업은 되돌릴 수 없습니다. 현재 진행 중인 경기는 다음 로그인에 합산되지 않습니다.</p><label>비밀번호 확인<input id="account-delete-password" type="password" autocomplete="current-password"></label><label><input id="account-delete-confirm" type="checkbox">계정과 전적 삭제에 동의합니다.</label><button id="account-delete">계정·공식 전적 영구 삭제</button></details></div>${ADMIN_MARKUP}<p id="account-status" role="status"></p><p>경험치·레벨·해금은 로그인 계정의 서버 기록입니다. 봇 경기와 기존 기기 기록은 ‘개인 전적’에서 확인하세요. 로그인 상태 변경은 다음 온라인 경기부터 반영됩니다.</p><button id="account-close">로비로 돌아가기</button></div></section>`;
export function createAccountView(authURL:string,endpoint:string,connect=connectAccount,onGrowth:(g:Growth,loggedIn:boolean)=>void=()=>{}){
 const el=(id:string)=>document.querySelector<HTMLElement>('#'+id)!;
 const panel=el('account-panel'),open=el('home-account');let previous:Element|null=null,busy=false,publicView=false;
 // No credentials or account UI is advertised before service configuration is complete.
 open.hidden=!authURL||!endpoint;
 const account=authURL&&endpoint?connect(authURL,endpoint):null;
 let authMode:'signin'|'signup'='signin';const defaultDescription=el('account-description').textContent;
 const status=(message:string)=>{el('account-status').textContent=message;};
 let displayedProfile:OfficialProfile|null=null;
 const adminView=createAdminView(async()=>account?await account:null,{
  open(){if(busy||publicView||!displayedProfile?.admin)return false;el('account-profile').hidden=true;el('account-status').hidden=true;el('account-title').textContent='관리자 · 레벨 편집';el('account-description').textContent='이메일로 계정을 찾아 레벨을 변경합니다. 변경 내용은 서버에 기록됩니다.';return true;},
  back(){el('account-status').hidden=false;draw(displayedProfile);},
  updated(g){onGrowth(g,true);},
  denied(){if(displayedProfile)displayedProfile.admin=false;el('account-status').hidden=false;draw(displayedProfile);status('관리자 권한이 없습니다.');},
 });
 function authScreen(mode:'signin'|'signup',focus=false){
  authMode=mode;el('account-form').hidden=mode==='signup';el('account-signup-form').hidden=mode!=='signup';
  el('account-title').textContent=mode==='signup'?'회원가입':'계정 · 공식 전적';
  el('account-description').textContent=mode==='signup'?'이메일과 비밀번호를 입력해 새 계정을 만드세요. 로그인하면 성장 기록을 서버에 저장할 수 있습니다.':defaultDescription;
  for(const input of panel.querySelectorAll<HTMLInputElement>('input[type=password]'))input.value='';
  if(focus)el(mode==='signup'?'signup-email':'account-email').focus();
 }
 function draw(profile:OfficialProfile|null){
  displayedProfile=profile;adminView.setAllowed(!publicView&&profile?.admin===true);
  if(profile)authMode='signin';
  authScreen(authMode);el('account-form').hidden=!!profile||publicView||authMode==='signup';el('account-signup-form').hidden=!!profile||publicView||authMode!=='signup';el('account-profile').hidden=!profile;
  for(const id of ['account-signout','account-refresh','account-delete','account-share'])el(id).hidden=publicView;
  el('account-profile').querySelector('details')!.hidden=publicView;el('nickname-edit-form').hidden=publicView;
  if(!publicView)onGrowth(profile?.growth??growth(0),!!profile);
  if(!profile)return;
  el('account-nickname').textContent=profile.nickname??'닉네임을 설정해 주세요';(el('profile-nickname') as HTMLInputElement).value=profile.nickname??'';
  el('account-public-id').textContent='대원 ID · '+profile.id;el('account-summary').textContent=`${!publicView&&profile.growth?'Lv'+profile.growth.level+' · '+profile.growth.xp+' XP · ':''}공식 온라인 ${profile.played}경기 · ${profile.wins}승 ${profile.played-profile.wins}패`;
  const list=el('account-recent');list.replaceChildren();for(const r of profile.recent){const li=document.createElement('li');li.textContent=`${r.mode==='ffa'?'개인전 · ':r.mode==='team'?'팀전 · ':''}${r.outcome==='win'?'승리':'패배'} · ${r.kills}킬 / ${r.deaths}데스 · ${new Date(r.endedAt).toLocaleString('ko-KR')}`;list.append(li);}
 }
 async function run(action:()=>Promise<void>){if(busy)return;busy=true;for(const b of panel.querySelectorAll<HTMLButtonElement>('button:not(#account-close)'))b.disabled=true;status('연결 중…');
  try{await action();await flushGrowth();}catch(error){status(error instanceof Error?error.message:'연결하지 못했습니다. 다시 시도하세요.');}
  finally{busy=false;for(const b of panel.querySelectorAll<HTMLButtonElement>('button'))b.disabled=false;for(const input of panel.querySelectorAll<HTMLInputElement>('input[type=password]'))input.value='';}
 }
 function show(){previous=document.activeElement;panel.hidden=false;for(const sibling of [...panel.parentElement!.children])if(sibling!==panel&&!sibling.hasAttribute('inert')){sibling.setAttribute('inert','');sibling.setAttribute('data-account-inert','');}el('account-close').focus();}
 function close(){adminView.reset();el('account-status').hidden=false;panel.hidden=true;for(const input of panel.querySelectorAll<HTMLInputElement>('input[type=password]'))input.value='';for(const sibling of document.querySelectorAll('[data-account-inert]')){sibling.removeAttribute('inert');sibling.removeAttribute('data-account-inert');}if(previous instanceof HTMLElement)previous.focus();}
 el('account-close').addEventListener('click',close);
 open.addEventListener('click',()=>{if(!account)return;publicView=false;authMode='signin';draw(null);show();void run(async()=>{const a=await account;await a.refresh();draw(a.profile);status(a.profile?'서버 공식 전적입니다.':'이메일과 비밀번호로 로그인하세요.');});});
 el('account-form').addEventListener('submit',event=>{event.preventDefault();const email=(el('account-email') as HTMLInputElement).value,password=(el('account-password') as HTMLInputElement).value;void run(async()=>{const a=await account!;await a.signIn(email,password);draw(a.profile);status('로그인했습니다. 다음 온라인 경기부터 공식 기록이 남습니다.');});});
 el('account-signup').addEventListener('click',()=>{if(busy)return;authScreen('signup',true);status('');});
 el('account-signup-back').addEventListener('click',()=>{if(busy)return;authScreen('signin',true);status('');});
 el('account-signup-form').addEventListener('submit',event=>{event.preventDefault();const email=(el('signup-email') as HTMLInputElement).value,password=(el('signup-password') as HTMLInputElement).value;void run(async()=>{const a=await account!;const nickname=normalizeNickname((el('signup-nickname') as HTMLInputElement).value);if(!nickname)throw Error('닉네임을2~16자로 입력하세요.');await a.signUp(email,password,nickname);draw(a.profile);status('회원가입했습니다.');});});
 el('nickname-edit-form').addEventListener('submit',event=>{event.preventDefault();void run(async()=>{const a=await account!;await a.setNickname((el('profile-nickname') as HTMLInputElement).value);draw(a.profile);status('닉네임을 저장했습니다. 다음 온라인 입장부터 반영됩니다.');});});
 el('account-signout').addEventListener('click',()=>void run(async()=>{const a=await account!;await a.signOut();draw(null);status('로그아웃했습니다. 비로그인으로 계속 플레이할 수 있습니다.');}));
 el('account-refresh').addEventListener('click',()=>void run(async()=>{const a=await account!;await a.refresh();draw(a.profile);status('서버 기록을 갱신했습니다.');}));
 el('account-delete').addEventListener('click',()=>void run(async()=>{if(!(el('account-delete-confirm') as HTMLInputElement).checked)throw Error('삭제 동의 항목을 확인하세요.');const password=(el('account-delete-password') as HTMLInputElement).value;if(!password)throw Error('삭제 확인용 비밀번호를 입력하세요.');const a=await account!,owner=a.profile?.id;await a.remove(password);pending=pending.filter(p=>p.ticket.owner!==owner);persist();draw(null);(el('account-delete-confirm') as HTMLInputElement).checked=false;status('계정과 공식 전적을 삭제했습니다.');}));
 el('account-share').addEventListener('click',()=>void run(async()=>{const a=await account!;if(!a.profile)return;const url=new URL(location.origin+location.pathname);url.searchParams.set('profile',a.profile.id);try{await navigator.clipboard.writeText(url.href);status('공개 전적 링크를 복사했습니다.');}catch{status('공개 전적 링크: '+url.href);}}));
 panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}if(event.key==='Tab'){const focusable=[...panel.querySelectorAll<HTMLElement>('button,input,summary')].filter(e=>!e.closest('[hidden]')&&!(e as HTMLButtonElement).disabled&&(!e.closest('details')||e.closest('details')!.open||e.tagName==='SUMMARY'));const index=focusable.indexOf(document.activeElement as HTMLElement);if(event.shiftKey&&index<=0||!event.shiftKey&&(index<0||index===focusable.length-1)){event.preventDefault();focusable[event.shiftKey?focusable.length-1:0]?.focus();}}});
 const shared=new URL(location.href).searchParams.get('profile');
 if(shared&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(shared)&&authURL&&endpoint){publicView=true;show();void run(async()=>{const response=await fetch(endpoint.replace(/\/$/,'')+'/profiles/'+shared,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('전적이 없거나 삭제되었습니다.');draw(await response.json());status('공개된 온라인 공식 전적입니다.');});}
 // Catch initialization failure without unhandled rejections; a configured login must not block guest boot.
 if(account)void account.then(async a=>{await a.refresh();onGrowth(a.profile?.growth??growth(0),!!a.profile);await flushGrowth();}).catch(()=>{onGrowth(growth(0),false);});
 type Ticket={id:string;owner:string};type Pending={ticket:Ticket;result:MatchResult};
 let pending:Pending[]=[];try{const value=JSON.parse(localStorage.getItem('harbor-growth-pending-v1')??'[]');if(Array.isArray(value))pending=value.filter(v=>v?.ticket&&/^[0-9a-f-]{36}$/i.test(v.ticket.id)&&/^[0-9a-f-]{36}$/i.test(v.ticket.owner)&&v.result).slice(-30);}catch{}
 const saveStatus=(text:string)=>{for(const id of ['growth-save','result-growth']){const node=document.getElementById(id);if(node)node.textContent=text;}};
 function persist(){try{localStorage.setItem('harbor-growth-pending-v1',JSON.stringify(pending));}catch{saveStatus('저장 대기 중 · 브라우저를 닫지 말고 다시 시도하세요.');}const retry=el('growth-retry');if(retry)retry.hidden=!pending.length;}
 if(pending.length)persist();
 let flushing:Promise<void>|null=null;
 function flushGrowth():Promise<void>{if(flushing)return flushing;flushing=(async()=>{if(!account)return;const a=await account;if(!a.profile)return;
   for(const item of [...pending]){if(item.ticket.owner!==a.profile?.id)continue;
    try{const data=await a.growthRequest('/growth/finish/'+item.ticket.id,item.result);if(!data)continue;
     if(a.profile?.id===item.ticket.owner){a.profile.growth=data;onGrowth(data,true);}pending=pending.filter(p=>p!==item);persist();saveStatus(`서버 저장 완료 · Lv${data.level} · ${data.xp} XP`);
    }catch{saveStatus('성장 서버 저장 대기 중 · 연결 후 다시 시도하세요.');break;}
   }
  })().finally(()=>{flushing=null;});return flushing;}
 el('growth-retry')?.addEventListener('click',()=>void flushGrowth());window.addEventListener('online',()=>void flushGrowth());
 return {
  async onlineIdentity(){if(!account)return {member:false,nickname:''};const a=await account;if(!await a.token())return {member:false,nickname:''};if(!a.profile)await a.refresh();return {member:true,nickname:a.profile?.nickname??''};},
  async saveNickname(name:string){if(!account)throw Error('로그인이 필요합니다.');const a=await account;await a.setNickname(name);draw(a.profile);},
  async refreshGrowth(){if(!account)return;const a=await account;await a.refresh();onGrowth(a.profile?.growth??growth(0),!!a.profile);await flushGrowth();},
  async startGrowth(mode:string,difficulty:string):Promise<Ticket|null>{
   if(!account||!['duel','ffa','survival'].includes(mode))return null;const a=await account,owner=a.profile?.id;if(!owner)return null;
   try{const data=await a.growthRequest('/growth/start',{mode,difficulty});if(!data)return null;saveStatus('성장 기록 연결됨 · 완료 시 서버에 저장');return {id:data.id,owner};}catch{saveStatus('성장 기록을 시작하지 못했습니다. 계정 연결을 확인하세요.');return null;}
  },
  async saveGrowth(ticket:Ticket|null,result:MatchResult){if(!ticket){saveStatus('로그인한 상태에서 시작한 경기부터 성장 기록이 서버에 저장됩니다.');return;}pending.push({ticket,result});persist();saveStatus('성장 서버 저장 중…');await flushGrowth();},
  async token(){return account?(await account).token():null;},get isOpen(){return !panel.hidden;}};
}
