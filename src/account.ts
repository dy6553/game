type AuthReply={data?:{user?:{id:string};session?:{token:string}}|null;error?:{message?:string}|null};
export type AuthSDK={getSession():Promise<AuthReply>;signIn:{email(body:{email:string;password:string}):Promise<unknown>};signUp:{email(body:{email:string;password:string;name:string}):Promise<unknown>};signOut():Promise<unknown>;deleteUser(body:{password:string}):Promise<unknown>};
export type OfficialProfile={id:string;played:number;wins:number;recent:{endedAt:number;outcome:'win'|'loss';kills:number;deaths:number}[]};
function checked(reply:unknown){if(reply&&typeof reply==='object'&&'error' in reply&&reply.error)throw Error('로그인 요청을 완료하지 못했습니다. 입력 내용과 연결을 확인하세요.');}
export function createAccount(sdk:AuthSDK,fetcher:typeof fetch,endpoint:string){
 let profile:OfficialProfile|null=null,operation=0;
 async function token(){const reply=await sdk.getSession();checked(reply);if(!reply.data?.user){profile=null;return null;}const jwt=reply.data.session?.token;if(!jwt||jwt.split('.').length!==3)throw Error('로그인 세션을 확인하지 못했습니다. 다시 로그인하세요.');return jwt;}
 return {
  get profile(){return profile;},token,
  async refresh(){const ticket=++operation;profile=null;const jwt=await token();if(!jwt)return;
   const response=await fetcher(endpoint.replace(/\/$/,'')+'/account',{headers:{Authorization:'Bearer '+jwt},signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('공식 전적에 연결하지 못했습니다. 잠시 후 다시 시도하세요.');const data=await response.json() as OfficialProfile;if(ticket===operation)profile=data;
  },
  async signIn(email:string,password:string){checked(await sdk.signIn.email({email,password}));await this.refresh();if(!profile)throw Error('로그인 쿠키를 확인하지 못했습니다. 일반 브라우저에서 다시 시도하세요.');},
  async signUp(email:string,password:string){checked(await sdk.signUp.email({email,password,name:'항구 대원'}));await this.refresh();if(!profile)throw Error('이메일 인증이 필요하면 받은 편지함을 확인한 뒤 로그인하세요.');},
  async signOut(){checked(await sdk.signOut());operation++;profile=null;},
  async remove(password:string){checked(await sdk.deleteUser({password}));operation++;profile=null;},
 };
}
export async function connectAccount(authURL:string,endpoint:string){
 const [{createAuthClient},{BetterAuthVanillaAdapter}]=await Promise.all([import('@neon/auth'),import('@neon/auth/vanilla/adapters')]);
 const sdk=createAuthClient(authURL,{adapter:BetterAuthVanillaAdapter({fetchOptions:{credentials:'include',timeout:10000}})});
 return createAccount(sdk,fetch,endpoint);
}
