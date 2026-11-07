// The caller has already verified the JWT. Never accept a subject or email from the body.
export async function deleteOwnAccount(request,env,subject,store,fetcher=fetch){
 const fail=(error,status)=>Response.json({error},{status});
 if(typeof subject!=='string'||!subject)return fail('로그인이 필요합니다.',401);
 let password;try{const text=await request.text();if(text.length>1024)return fail('요청 크기를 확인하세요.',400);password=JSON.parse(text).password;}catch{return fail('비밀번호를 입력하세요.',400);}
 if(typeof password!=='string'||password.length<8||password.length>128)return fail('비밀번호를 입력하세요.',400);
 try{
  const email=await store.emailFor(subject);if(!email)return fail('다시 로그인하세요.',401);
  const response=await fetcher(env.NEON_AUTH_URL.replace(/\/$/,'')+'/sign-in/email',{method:'POST',headers:{'Content-Type':'application/json',Origin:request.headers.get('Origin')},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)return fail(response.status===401?'비밀번호를 확인하세요.':'계정 확인 서비스에 연결하지 못했습니다.',response.status===401?403:503);
  const verified=await response.json();if(verified.user?.id!==subject)return fail('계정 확인에 실패했습니다.',403);
  // Auth and game rows are deleted atomically by the existing foreign keys/delete trigger.
  await store.remove(subject);return Response.json({ok:true});
 }catch{return fail('계정을 삭제하지 못했습니다. 잠시 후 다시 시도하세요.',503);}
}
