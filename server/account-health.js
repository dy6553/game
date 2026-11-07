import {neon} from '@neondatabase/serverless';
const query=`SELECT to_regclass('neon_auth."user"') IS NOT NULL AS auth,
 to_regclass('harbor.profiles') IS NOT NULL AS profiles,
 to_regclass('harbor.receipts') IS NOT NULL AS receipts,
 to_regclass('harbor.recent') IS NOT NULL AS recent,
 EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='harbor_delete_records'
  AND tgrelid=to_regclass('neon_auth."user"') AND tgenabled IN ('O','A')) AS purge`;
export async function checkAccountHealth(env,run){
 const result={databaseConfigured:!!env.DATABASE_URL,database:'missing',authConfigured:!!env.NEON_AUTH_URL,enabled:env.ACCOUNTS_ENABLED==='true',ready:false};
 if(!result.databaseConfigured)return result;
 try{
  const rows=await (run?run(query):neon(env.DATABASE_URL,{fetchOptions:{signal:AbortSignal.timeout(8000)}}).query(query,[]));
  const row=rows[0];result.database=row&&['auth','profiles','receipts','recent','purge'].every(key=>row[key]===true)?'ready':'schema_missing';
  result.ready=result.database==='ready'&&result.authConfigured&&result.enabled;
 }catch{result.database='unavailable';}
 return result;
}
// This reads catalog metadata only. Limit repeated probes to protect the free DB allowance.
const cache=new WeakMap();
export function accountHealth(env){const previous=cache.get(env);if(previous&&previous.until>Date.now())return previous.value;const value=checkAccountHealth(env);cache.set(env,{until:Date.now()+30000,value});return value;}
