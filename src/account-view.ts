import {connectAccount,type OfficialProfile} from './account.ts';
export const ACCOUNT_MARKUP=`<section id="account-panel" class="account-panel" role="dialog" aria-modal="true" aria-labelledby="account-title" hidden><div class="account-card"><span class="eyebrow">HARBOR / PLAYER PROFILE</span><h2 id="account-title">계정 · 공식 전적</h2><p>로그인 없이도 모든 게임 모드를 플레이할 수 있습니다. 로그인한 온라인 경기만 공식 전적으로 저장됩니다. 전적용 ID와 성적은 다른 사람도 볼 수 있으며 이메일은 공개하지 않습니다.</p><form id="account-form"><label>이메일<input id="account-email" type="email" autocomplete="email" required maxlength="254"></label><label>비밀번호<input id="account-password" type="password" autocomplete="current-password" minlength="8" maxlength="128" required></label><div class="account-actions"><button id="account-signin" type="submit">로그인</button><button id="account-signup" type="button">회원가입</button></div></form><div id="account-profile" hidden><p id="account-public-id"></p><p id="account-summary"></p><ol id="account-recent"></ol><button id="account-share">공개 전적 링크 복사</button><button id="account-refresh">전적 새로고침</button><button id="account-signout">로그아웃</button><details><summary>계정 삭제</summary><p>계정과 공식 전적·누적 승패를 함께 삭제합니다. 이 작업은 되돌릴 수 없습니다. 현재 진행 중인 경기는 다음 로그인에 합산되지 않습니다.</p><label>비밀번호 확인<input id="account-delete-password" type="password" autocomplete="current-password"></label><label><input id="account-delete-confirm" type="checkbox">계정과 전적 삭제에 동의합니다.</label><button id="account-delete">계정·공식 전적 영구 삭제</button></details></div><p id="account-status" role="status"></p><p>봇 경기와 기존 기기 기록은 ‘개인 전적’에서 확인하세요. 로그인 상태 변경은 다음 온라인 경기부터 반영됩니다.</p><button id="account-close">로비로 돌아가기</button></div></section>`;
export function createAccountView(authURL:string,endpoint:string,connect=connectAccount){
 const el=(id:string)=>document.querySelector<HTMLElement>('#'+id)!;
 const panel=el('account-panel'),open=el('home-account');let previous:Element|null=null,busy=false,publicView=false;
 // No credentials or account UI is advertised before service configuration is complete.
 open.hidden=!authURL||!endpoint;
 const account=authURL&&endpoint?connect(authURL,endpoint):null;
 const status=(message:string)=>{el('account-status').textContent=message;};
 function draw(profile:OfficialProfile|null){
  el('account-form').hidden=!!profile||publicView;el('account-profile').hidden=!profile;
  for(const id of ['account-signout','account-refresh','account-delete','account-share'])el(id).hidden=publicView;
  el('account-profile').querySelector('details')!.hidden=publicView;
  if(!profile)return;
  el('account-public-id').textContent='대원 ID · '+profile.id;el('account-summary').textContent=`공식 온라인 ${profile.played}경기 · ${profile.wins}승 ${profile.played-profile.wins}패`;
  const list=el('account-recent');list.replaceChildren();for(const r of profile.recent){const li=document.createElement('li');li.textContent=`${r.outcome==='win'?'승리':'패배'} · ${r.kills}킬 / ${r.deaths}데스 · ${new Date(r.endedAt).toLocaleString('ko-KR')}`;list.append(li);}
 }
 async function run(action:()=>Promise<void>){if(busy)return;busy=true;for(const b of panel.querySelectorAll<HTMLButtonElement>('button:not(#account-close)'))b.disabled=true;status('연결 중…');
  try{await action();}catch(error){status(error instanceof Error?error.message:'연결하지 못했습니다. 다시 시도하세요.');}
  finally{busy=false;for(const b of panel.querySelectorAll<HTMLButtonElement>('button'))b.disabled=false;for(const input of panel.querySelectorAll<HTMLInputElement>('input[type=password]'))input.value='';}
 }
 function show(){previous=document.activeElement;panel.hidden=false;for(const sibling of [...panel.parentElement!.children])if(sibling!==panel&&!sibling.hasAttribute('inert')){sibling.setAttribute('inert','');sibling.setAttribute('data-account-inert','');}el('account-close').focus();}
 function close(){panel.hidden=true;for(const sibling of document.querySelectorAll('[data-account-inert]')){sibling.removeAttribute('inert');sibling.removeAttribute('data-account-inert');}if(previous instanceof HTMLElement)previous.focus();}
 el('account-close').addEventListener('click',close);
 open.addEventListener('click',()=>{if(!account)return;publicView=false;draw(null);show();void run(async()=>{const a=await account;await a.refresh();draw(a.profile);status(a.profile?'서버 공식 전적입니다.':'이메일과 비밀번호로 로그인하세요.');});});
 el('account-form').addEventListener('submit',event=>{event.preventDefault();void run(async()=>{const a=await account!;await a.signIn((el('account-email') as HTMLInputElement).value,(el('account-password') as HTMLInputElement).value);draw(a.profile);status('로그인했습니다. 다음 온라인 경기부터 공식 기록이 남습니다.');});});
 el('account-signup').addEventListener('click',()=>{if(!(el('account-form') as HTMLFormElement).reportValidity())return;void run(async()=>{const a=await account!;await a.signUp((el('account-email') as HTMLInputElement).value,(el('account-password') as HTMLInputElement).value);draw(a.profile);status('회원가입했습니다.');});});
 el('account-signout').addEventListener('click',()=>void run(async()=>{const a=await account!;await a.signOut();draw(null);status('로그아웃했습니다. 비로그인으로 계속 플레이할 수 있습니다.');}));
 el('account-refresh').addEventListener('click',()=>void run(async()=>{const a=await account!;await a.refresh();draw(a.profile);status('서버 기록을 갱신했습니다.');}));
 el('account-delete').addEventListener('click',()=>void run(async()=>{if(!(el('account-delete-confirm') as HTMLInputElement).checked)throw Error('삭제 동의 항목을 확인하세요.');const password=(el('account-delete-password') as HTMLInputElement).value;if(!password)throw Error('삭제 확인용 비밀번호를 입력하세요.');const a=await account!;await a.remove(password);draw(null);(el('account-delete-confirm') as HTMLInputElement).checked=false;status('계정과 공식 전적을 삭제했습니다.');}));
 el('account-share').addEventListener('click',()=>void run(async()=>{const a=await account!;if(!a.profile)return;const url=new URL(location.origin+location.pathname);url.searchParams.set('profile',a.profile.id);try{await navigator.clipboard.writeText(url.href);status('공개 전적 링크를 복사했습니다.');}catch{status('공개 전적 링크: '+url.href);}}));
 panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}if(event.key==='Tab'){const focusable=[...panel.querySelectorAll<HTMLElement>('button,input,summary')].filter(e=>!e.closest('[hidden]')&&!(e as HTMLButtonElement).disabled&&(!e.closest('details')||e.closest('details')!.open||e.tagName==='SUMMARY'));const index=focusable.indexOf(document.activeElement as HTMLElement);if(event.shiftKey&&index<=0||!event.shiftKey&&(index<0||index===focusable.length-1)){event.preventDefault();focusable[event.shiftKey?focusable.length-1:0]?.focus();}}});
 const shared=new URL(location.href).searchParams.get('profile');
 if(shared&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(shared)&&authURL&&endpoint){publicView=true;show();void run(async()=>{const response=await fetch(endpoint.replace(/\/$/,'')+'/profiles/'+shared,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('전적이 없거나 삭제되었습니다.');draw(await response.json());status('공개된 온라인 공식 전적입니다.');});}
 // Catch initialization failure without unhandled rejections; a configured login must not block guest boot.
 if(account)void account.catch(()=>{});
 return {async token(){return account?(await account).token():null;},get isOpen(){return !panel.hidden;}};
}
