import {neon} from '@neondatabase/serverless';
import migration from './growth-schema.js';
import adminMigration from './admin-schema.js';
import nicknameMigration from './nickname-schema.js';
import {normalizeNickname} from '../src/nickname.ts';
import multiplayerMigration from './multiplayer-schema.js';
import {createAdminStore} from './admin-levels.js';
import {growth,reward} from '../src/progression.ts';
import {validRun,validFinish} from './growth.js';
import {publicProfile} from './official-records.js';
const preparations=new WeakMap();
export function createRecordStore(env,database){
 if(!database&&!env.DATABASE_URL)throw Error('Database is not configured');
 const sql=database??neon(env.DATABASE_URL,{fetchOptions:{signal:AbortSignal.timeout(10000)}});
 async function prepare(){
  if(!preparations.has(env))preparations.set(env,sql.transaction([...(migration+adminMigration).split(';').map(s=>s.trim()).filter(Boolean).map(s=>sql.query(s)),...[...multiplayerMigration,...nicknameMigration].map(s=>sql.query(s))]).catch(error=>{preparations.delete(env);throw error;}));
  await preparations.get(env);
 }
 const admin=createAdminStore(sql);
 return {
  async setNickname(subject,value){const nickname=normalizeNickname(value);if(!nickname)throw Error('Invalid nickname');await prepare();await this.account(subject);const rows=await sql`UPDATE harbor.profiles p SET nickname=${nickname} FROM neon_auth."user" u WHERE p.subject=${subject} AND u.id::text=p.subject RETURNING p.id`;if(!rows.length)throw Error('Account no longer exists');return this.account(subject);},
  async isAdmin(subject){await prepare();return admin.isAdmin(subject);},
  async adminFind(subject,email){await prepare();return admin.find(subject,email);},
  async adminEdit(subject,body){await prepare();return admin.edit(subject,body);},
  async progression(subject){
   await prepare();const rows=await sql`SELECT COALESCE(g.xp,0) AS xp FROM harbor.profiles p JOIN neon_auth."user" u ON u.id::text=p.subject LEFT JOIN harbor.growth g ON g.profile_id=p.id WHERE p.subject=${subject}`;
   if(!rows.length)throw Error('Account no longer exists');return growth(Number(rows[0].xp));
  },
  async startRun(subject,body){
   if(!validRun(body))throw Error('Invalid run');await prepare();await this.account(subject);
   const id=crypto.randomUUID();const rows=await sql`INSERT INTO harbor.growth_runs(id,profile_id,mode,difficulty,started_at)
    SELECT ${id}::uuid,p.id,${body.mode},${body.difficulty},${Date.now()} FROM harbor.profiles p JOIN neon_auth."user" u ON u.id::text=p.subject WHERE p.subject=${subject} RETURNING id`;
   if(!rows.length)throw Error('Account no longer exists');return {id};
  },
  async finishRun(subject,id,body){
   if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Invalid run');await prepare();
   const rows=await sql`SELECT r.mode,r.difficulty FROM harbor.growth_runs r JOIN harbor.profiles p ON p.id=r.profile_id JOIN neon_auth."user" u ON u.id::text=p.subject WHERE r.id=${id}::uuid AND p.subject=${subject}`;
   const run=rows[0];if(!validFinish(body,run))throw Error('Invalid finish');const xp=reward({...body,mode:run.mode});
   await sql`WITH receipt AS (UPDATE harbor.growth_runs r SET xp=${xp} FROM harbor.profiles p,neon_auth."user" u WHERE r.id=${id}::uuid AND r.profile_id=p.id AND p.subject=${subject} AND u.id::text=p.subject AND r.xp IS NULL RETURNING r.profile_id)
    INSERT INTO harbor.growth(profile_id,xp) SELECT profile_id,${xp} FROM receipt ON CONFLICT(profile_id) DO UPDATE SET xp=harbor.growth.xp+EXCLUDED.xp`;
   return this.progression(subject);
  },
  async emailFor(subject){const rows=await sql`SELECT email FROM neon_auth."user" WHERE id::text=${subject}`;return rows[0]?.email??null;},
  async remove(subject){await sql`DELETE FROM neon_auth."user" WHERE id::text=${subject}`;},
  async account(subject){
   // A valid but previously issued JWT cannot recreate a deleted managed account.
   const rows=await sql`INSERT INTO harbor.profiles(subject)
    SELECT id::text FROM neon_auth."user" WHERE id::text=${subject} FOR KEY SHARE
    ON CONFLICT(subject) DO UPDATE SET subject=EXCLUDED.subject RETURNING id`;
   if(!rows.length)throw Error('Account no longer exists');
   return {...await this.profile(rows[0].id),growth:await this.progression(subject),admin:await this.isAdmin(subject)};
  },
  async profile(id){
   await prepare();
   const rows=await sql`SELECT p.id,p.played,p.wins,p.nickname,
    COALESCE((SELECT jsonb_agg(r ORDER BY r.ended_at DESC,r.match_id DESC)
     FROM (SELECT ended_at,outcome,kills,deaths,match_id,mode FROM harbor.recent
      WHERE profile_id=p.id ORDER BY ended_at DESC,match_id DESC LIMIT 20) r),'[]'::jsonb) AS recent
    FROM harbor.profiles p JOIN neon_auth."user" u ON u.id::text=p.subject WHERE p.id=${id}::uuid`;
   return rows.length?publicProfile(rows[0]):null;
  },
  async write(event){
   await prepare();
   // Receipt + totals + history are atomic; pruning below is independently retryable.
   // The lock also makes concurrent writes for this account serialize before trimming.
   await sql.transaction(event.rows.map(row=>sql`WITH owner AS MATERIALIZED (
     SELECT p.id FROM harbor.profiles p JOIN neon_auth."user" u ON u.id::text=p.subject
     WHERE p.subject=${row.subject} FOR UPDATE OF p
    ), receipt AS (
     INSERT INTO harbor.receipts(profile_id,match_id) SELECT id,${event.matchId}::uuid FROM owner
     ON CONFLICT DO NOTHING RETURNING profile_id
    ), totals AS (
     UPDATE harbor.profiles SET played=played+1,wins=wins+${row.outcome==='win'?1:0}
     WHERE id IN (SELECT profile_id FROM receipt) RETURNING id
    ), awarded AS (
     INSERT INTO harbor.growth(profile_id,xp) SELECT id,${reward({...row,mode:'online'})} FROM totals WHERE ${event.endedAt}>=(SELECT started_at FROM harbor.growth_epoch WHERE single)
     ON CONFLICT(profile_id) DO UPDATE SET xp=harbor.growth.xp+EXCLUDED.xp RETURNING profile_id
    ), history AS (
     INSERT INTO harbor.recent(profile_id,match_id,ended_at,outcome,kills,deaths,mode)
     SELECT id,${event.matchId}::uuid,${event.endedAt},${row.outcome},${row.kills},${row.deaths},${event.mode??'duel'} FROM totals RETURNING profile_id
    ) SELECT profile_id FROM history`));
   // Separate pruning cannot lose a result or affect counters if interrupted; retry is idempotent.
   // Keep the newest 20 even when an older queued result arrives after a newer match.
   await sql`DELETE FROM harbor.recent WHERE (profile_id,match_id) IN (
    SELECT profile_id,match_id FROM (
     SELECT profile_id,match_id,row_number() OVER(PARTITION BY profile_id ORDER BY ended_at DESC,match_id DESC) AS n
     FROM harbor.recent WHERE profile_id IN (SELECT id FROM harbor.profiles WHERE subject=ANY(${event.rows.map(r=>r.subject)}::text[]))
    ) ranked WHERE n>20)`;
  },
 };
}
