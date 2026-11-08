import assert from 'node:assert/strict';
const {parseHTML}=await import(process.env.HARBOR_DOM_MODULE??'linkedom');
const {ACCOUNT_MARKUP,createAccountView}=await import('../../src/account-view.ts');
const {window,document}=parseHTML('<html><body><div id="app"><section id="home"><button id="home-account" hidden>계정</button><button id="guest-play">게임 시작</button></section>'+ACCOUNT_MARKUP+'</div></body></html>');
let active=null;window.HTMLElement.prototype.focus=function(){active=this;};Object.defineProperty(document,'activeElement',{get:()=>active});
const isPublic=process.argv.includes('--public');Object.assign(globalThis,{window,document,HTMLElement:window.HTMLElement,location:new URL('https://game.test/'+(isPublic?'?profile=00000000-0000-4000-8000-000000000001':''))});
const el=id=>document.querySelector('#'+id),click=id=>el(id).dispatchEvent(new window.Event('click',{bubbles:true}));const settle=()=>new Promise(r=>setImmediate(r));
const profile={id:'00000000-0000-4000-8000-000000000001',played:3,wins:2,recent:[{endedAt:1000,outcome:'win',kills:10,deaths:2}]};
let removed=0,registrations=0;const account={profile:null,async refresh(){},async token(){return null;},async signIn(){this.profile=profile;},async signUp(){registrations++;this.profile=profile;},async signOut(){this.profile=null;},async remove(){removed++;this.profile=null;}};
if(isPublic)globalThis.fetch=async url=>{assert.match(url,/\/profiles\//);return Response.json({...profile,admin:true,email:'private@example.com',subject:'secret-account'});};
const view=createAccountView('https://auth.test','https://worker.test',async()=>account);
if(isPublic){await settle();assert.equal(view.isOpen,true);assert.equal(el('account-form').hidden,true);assert.equal(el('account-signout').hidden,true);assert.equal(el('account-admin-open').hidden,true);assert.equal(el('account-profile').querySelector('details').hidden,true);assert.equal(el('account-public-id').textContent.includes('private@example.com'),false);assert.match(el('account-summary').textContent,/3경기/);click('account-close');assert.equal(el('home').hasAttribute('inert'),false);console.log('PASS: shared profile loads without login and hides account/deletion actions and private fields');process.exit(0);}
assert.equal(el('home-account').hidden,false);click('home-account');await settle();assert.equal(view.isOpen,true);assert.ok(el('home').hasAttribute('inert'));assert.equal(el('account-form').hidden,false);
if(process.argv.includes('--signup')){
 let validations=0;el('account-form').reportValidity=()=>{validations++;return false;};
 click('account-signup');await settle();
 assert.equal(validations,0,'registration entry must open before validating the login form');
 assert.equal(el('account-form').hidden,true);assert.equal(el('account-signup-form').hidden,false);assert.equal(el('account-title').textContent,'회원가입');assert.equal(registrations,0);
 assert.equal(document.activeElement,el('signup-email'));assert.equal(el('signup-password').getAttribute('autocomplete'),'new-password');
 el('signup-password').value='temporary-password';click('account-signup-back');assert.equal(el('account-form').hidden,false);assert.equal(el('account-signup-form').hidden,true);assert.equal(el('signup-password').value,'');
 click('account-signup');el('signup-email').value='new@example.com';el('signup-password').value='password';
 el('account-signup-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();
 assert.equal(registrations,1);assert.equal(el('account-profile').hidden,false);assert.equal(el('account-signup-form').hidden,true);assert.equal(el('signup-password').value,'');
 click('account-signout');await settle();assert.equal(el('account-form').hidden,false);assert.equal(el('account-signup-form').hidden,true);
 click('account-signup');el('signup-password').value='temporary-password';click('account-close');assert.equal(el('signup-password').value,'');click('home-account');await settle();assert.equal(el('account-form').hidden,false);assert.equal(el('account-signup-form').hidden,true);
 click('account-close');console.log('PASS: empty-form signup entry, separate screen/back, focus/autocomplete, one registration submit, signout and reopen reset, password clearing');process.exit(0);
}
el('account-email').value='private@example.com';el('account-password').value='password';el('account-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();
assert.equal(el('account-profile').hidden,false);assert.match(el('account-summary').textContent,/3경기 · 2승 1패/);assert.equal(el('account-password').value,'');assert.equal(el('account-recent').children.length,1);assert.equal(el('account-public-id').textContent.includes('private@example.com'),false);
el('account-delete-password').value='password';click('account-delete');await settle();assert.equal(removed,0);assert.match(el('account-status').textContent,/동의/);
el('account-delete-confirm').checked=true;el('account-delete-password').value='password';click('account-delete');await settle();assert.equal(removed,1);assert.equal(el('account-profile').hidden,true);click('account-close');assert.equal(view.isOpen,false);assert.equal(el('home').hasAttribute('inert'),false);
console.log('PASS: configured account modal, guest entry retained, focus/inert cleanup, authenticated summary, password clearing, guarded account deletion');
