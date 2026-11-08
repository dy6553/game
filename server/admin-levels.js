import {growth} from '../src/progression.ts';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
export function validAdminEmail(v){return typeof v==='string'&&v.trim().length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());}
export function parseLevelEdit(b){
 if(!b||!uuid(b.id)||!uuid(b.requestId)||!Number.isSafeInteger(b.level)||b.level<1||!Number.isSafeInteger(b.expectedXP)||b.expectedXP<0||typeof b.reason!=='string'||b.reason.length>200)return null;
 const xp=(b.level-1)*200;if(!Number.isSafeInteger(xp))return null;
 return {id:b.id,requestId:b.requestId,level:b.level,expectedXP:b.expectedXP,reason:b.reason.trim(),xp};
}
const fail=(status)=>Object.assign(Error('Admin operation failed'),{status});
export function createAdminStore(sql){
 async function isAdmin(subject){const rows=await sql`SELECT m.profile_id FROM harbor.admin_members m JOIN harbor.profiles p ON p.id=m.profile_id JOIN neon_auth."user" u ON u.id::text=p.subject WHERE p.subject=${subject}`;return rows.length===1;}
 async function read(subject,id){
  const rows=await sql`SELECT p.id,COALESCE(g.xp,0) AS xp FROM harbor.profiles p JOIN neon_auth."user" u ON u.id::text=p.subject LEFT JOIN harbor.growth g ON g.profile_id=p.id WHERE p.id=${id}::uuid AND EXISTS(SELECT 1 FROM harbor.admin_members m JOIN harbor.profiles actor ON actor.id=m.profile_id JOIN neon_auth."user" au ON au.id::text=actor.subject WHERE actor.subject=${subject})`;
  if(!rows.length)throw fail(404);
  const history=await sql`SELECT before_xp,after_xp,reason,changed_at FROM harbor.admin_level_edits WHERE target_id=${id}::uuid ORDER BY changed_at DESC,request_id DESC LIMIT 10`;
  return {id:rows[0].id,growth:growth(Number(rows[0].xp)),history:history.map(r=>({beforeXP:Number(r.before_xp),afterXP:Number(r.after_xp),reason:r.reason,changedAt:Number(r.changed_at)}))};
 }
 return {isAdmin,
  async find(subject,email){
   if(!await isAdmin(subject))throw fail(403);if(!validAdminEmail(email))throw fail(400);
   const rows=await sql`SELECT p.id FROM harbor.profiles p JOIN neon_auth."user" u ON u.id::text=p.subject WHERE lower(u.email)=${email.trim().toLowerCase()} LIMIT 2`;
   if(rows.length!==1)throw fail(404);return read(subject,rows[0].id);
  },
  async edit(subject,body){
   if(!await isAdmin(subject))throw fail(403);const b=parseLevelEdit(body);if(!b)throw fail(400);
   const result=await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${b.requestId},0))`,
    sql`WITH actor AS MATERIALIZED (
     SELECT p.id FROM harbor.profiles p JOIN harbor.admin_members m ON m.profile_id=p.id JOIN neon_auth."user" u ON u.id::text=p.subject WHERE p.subject=${subject} FOR KEY SHARE OF m,u
    ), target AS MATERIALIZED (
     SELECT p.id,COALESCE(g.xp,0) AS xp FROM harbor.profiles p JOIN neon_auth."user" u ON u.id::text=p.subject LEFT JOIN harbor.growth g ON g.profile_id=p.id WHERE p.id=${b.id}::uuid AND EXISTS(SELECT 1 FROM actor) FOR UPDATE OF p
    ), prior AS MATERIALIZED (
     SELECT actor_id,target_id FROM harbor.admin_level_edits WHERE request_id=${b.requestId}::uuid
    ), eligible AS MATERIALIZED (
     SELECT * FROM target WHERE xp=${b.expectedXP} AND NOT EXISTS(SELECT 1 FROM prior)
    ), changed AS (
     INSERT INTO harbor.growth(profile_id,xp) SELECT id,${b.xp} FROM eligible
     ON CONFLICT(profile_id) DO UPDATE SET xp=EXCLUDED.xp WHERE harbor.growth.xp=${b.expectedXP} RETURNING profile_id
    ), audited AS (
     INSERT INTO harbor.admin_level_edits(request_id,actor_id,target_id,before_xp,after_xp,reason,changed_at)
     SELECT ${b.requestId}::uuid,actor.id,eligible.id,eligible.xp,${b.xp},${b.reason},${Date.now()} FROM actor,eligible JOIN changed ON changed.profile_id=eligible.id RETURNING request_id
    ) SELECT CASE
     WHEN NOT EXISTS(SELECT 1 FROM actor) THEN 'forbidden'
     WHEN EXISTS(SELECT 1 FROM prior JOIN actor ON prior.actor_id=actor.id WHERE prior.target_id=${b.id}::uuid) THEN 'replayed'
     WHEN EXISTS(SELECT 1 FROM prior) THEN 'conflict'
     WHEN EXISTS(SELECT 1 FROM audited) THEN 'applied'
     WHEN NOT EXISTS(SELECT 1 FROM target) THEN 'missing'
     ELSE 'conflict' END AS status`
   ]);
   const status=result[1][0]?.status;if(!['applied','replayed'].includes(status))throw fail(status==='forbidden'?403:status==='missing'?404:409);
   return {...await read(subject,b.id),replayed:status==='replayed'};
  },
 };
}
