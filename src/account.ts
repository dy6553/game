import type {Growth} from './progression.ts';
type AuthReply={data?:{user?:{id:string};session?:{token:string}}|null;error?:{message?:string}|null};
export type AuthSDK={getSession():Promise<AuthReply>;signIn:{email(body:{email:string;password:string}):Promise<unknown>};signUp:{email(body:{email:string;password:string;name:string}):Promise<unknown>};signOut():Promise<unknown>};
export type OfficialProfile={admin?:boolean;growth?:Growth;id:string;played:number;wins:number;recent:{endedAt:number;outcome:'win'|'loss';kills:number;deaths:number}[]};
function checked(reply:unknown){if(reply&&typeof reply==='object'&&'error' in reply&&reply.error)throw Error('로그인 요청을 완료하지 못했습니다. 입력 내용과 연결을 확인하세요.');}
export function createAccount(sdk:AuthSDK,fetcher:typeof fetch,endpoint:string){
 let profile:OfficialProfile|null=null,operation=0,signedOut=false;
 async function token(){if(signedOut)return null;const reply=await sdk.getSession();checked(reply);if(!reply.data?.user){profile=null;return null;}const jwt=reply.data.session?.token;if(!jwt||jwt.split('.').length!==3)throw Error('로그인 세션을 확인하지 못했습니다. 다시 로그인하세요.');return jwt;}
 return {
  get profile(){return profile;},token,
  async adminRequest(path:'/admin/players/find'|'/admin/players/level',body:unknown){
   const owner=profile?.id,jwt=await token();if(!owner||!jwt)throw Error('로그인이 필요합니다.');
   const response=await fetcher(endpoint.replace(/\/$/,'')+path,{method:'POST',headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
   if(!response.ok){const messages:Record<number,string>={400:'입력 내용을 확인하세요.',401:'다시 로그인하세요.',403:'관리자 권한이 필요합니다.',404:'계정을 찾지 못했습니다. 해당 계정으로 게임에 먼저 로그인했는지 확인하세요.',409:'경험치가 변경되었습니다. 계정을 다시 조회한 뒤 저장하세요.'};throw Object.assign(Error(messages[response.status]??'관리자 요청을 완료하지 못했습니다. 잠시 후 다시 시도하세요.'),{status:response.status});}
   const data=await response.json();if(profile?.id!==owner)throw Error('로그인 계정이 변경되었습니다.');return data;
  },
  async growthRequest(path:string,body:unknown){
   const owner=profile?.id,jwt=await token();if(!owner||!jwt)return null;
   const response=await fetcher(endpoint.replace(/\/$/,'')+path,{method:'POST',headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Error('성장 기록을 서버에 저장하지 못했습니다. 연결 후 다시 시도하세요.');
   const data=await response.json();if(profile?.id!==owner)throw Error('로그인 계정이 변경되었습니다.');return data;
  },
  async refresh(){const ticket=++operation;profile=null;const jwt=await token();if(!jwt)return;
   const response=await fetcher(endpoint.replace(/\/$/,'')+'/account',{headers:{Authorization:'Bearer '+jwt},signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('공식 전적에 연결하지 못했습니다. 잠시 후 다시 시도하세요.');const data=await response.json() as OfficialProfile;if(ticket===operation)profile=data;
  },
  async signIn(email:string,password:string){checked(await sdk.signIn.email({email,password}));signedOut=false;await this.refresh();if(!profile)throw Error('로그인 쿠키를 확인하지 못했습니다. 일반 브라우저에서 다시 시도하세요.');},
  async signUp(email:string,password:string){checked(await sdk.signUp.email({email,password,name:'항구 대원'}));signedOut=false;await this.refresh();if(!profile)throw Error('이메일 인증이 필요하면 받은 편지함을 확인한 뒤 로그인하세요.');},
  async signOut(){checked(await sdk.signOut());operation++;profile=null;signedOut=true;},
  async remove(password:string){
   if(password.length<8||password.length>128)throw Error('비밀번호를 입력하세요.');const jwt=await token();if(!jwt)throw Error('로그인이 필요합니다.');
   const response=await fetcher(endpoint.replace(/\/$/,'')+'/account',{method:'DELETE',headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify({password}),signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Error(response.status===403?'비밀번호를 확인하세요.':'계정을 삭제하지 못했습니다. 잠시 후 다시 시도하세요.');operation++;profile=null;signedOut=true;
   try{await sdk.signOut();}catch{/* The user row is already gone. Local guest mode must remain usable. */}
  },
 };
}
export async function connectAccount(authURL:string,endpoint:string){
 const [{createAuthClient},{BetterAuthVanillaAdapter}]=await Promise.all([import('@neon/auth'),import('@neon/auth/vanilla/adapters')]);
 const sdk=createAuthClient(authURL,{adapter:BetterAuthVanillaAdapter({fetchOptions:{credentials:'include',timeout:10000}})});
 return createAccount(sdk,fetch,endpoint);
}
