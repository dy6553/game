import {importJWK,jwtVerify} from 'jose';
import {neon} from '@neondatabase/serverless';
import {config as deployedConfig,approvedSQL} from './approved-cleanup-config.js';
// Temporary administrator job, explicitly approved for one synthetic account on 2026-11-07.
// No client can supply SQL, a target account, or a replacement verification key.
export async function runApprovedCleanup(request,env,options={}){
 const config=options.config??deployedConfig,now=options.now??Date.now();
 const deny=(error,status)=>Response.json({error},{status});
 if(now>config.deadline)return deny('expired',410);
 if(request.method!=='POST')return deny('method',405);
 const authorization=request.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return deny('unauthorized',401);
 try{
  const key=await importJWK(config.publicKey,'EdDSA');
  const {payload}=await jwtVerify(authorization.slice(7),key,{algorithms:['EdDSA'],issuer:'harbor-approved-maintenance',audience:'https://game.yuni100106yuni.workers.dev',subject:config.job,requiredClaims:['exp','iat','sub'],maxTokenAge:'10m',currentDate:new Date(now)});
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(approvedSQL)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(payload.sql!==config.sqlHash||hash!==config.sqlHash||payload.exp*1000>config.deadline)return deny('unauthorized',401);
 }catch{return deny('unauthorized',401);}
 try{const text=await request.text();if(text.length>32)return deny('body',400);const body=JSON.parse(text||'{}');if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).length||new URL(request.url).search)return deny('body',400);}catch{return deny('body',400);}
 try{
  const rows=await (options.query?options.query(approvedSQL):neon(env.DATABASE_URL,{fetchOptions:{signal:AbortSignal.timeout(10000)}}).query(approvedSQL,[]));
  if(!Array.isArray(rows)||rows.length>1)return deny('unexpected result',503);
  return Response.json({ok:true,deleted:rows.length});
 }catch{return deny('job failed',503);}
}
