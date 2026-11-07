import {neon} from '@neondatabase/serverless';
import {publicProfile} from './official-records.js';
export function createRecordStore(env,database){
 if(!database&&!env.DATABASE_URL)throw Error('Database is not configured');
 const sql=database??neon(env.DATABASE_URL,{fetchOptions:{signal:AbortSignal.timeout(10000)}});
 return {
  async emailFor(subject){const rows=await sql`SELECT email FROM neon_auth."user" WHERE id::text=${subject}`;return rows[0]?.email??null;},
  async remove(subject){await sql`DELETE FROM neon_auth."user" WHERE id::text=${subject}`;},
  async account(subject){
   // A valid but previously issued JWT cannot recreate a deleted managed account.
   const rows=await sql`INSERT INTO harbor.profiles(subject)
    SELECT id::text FROM neon_auth."user" WHERE id::text=${subject} FOR KEY SHARE
    ON CONFLICT(subject) DO UPDATE SET subject=EXCLUDED.subject RETURNING id`;
   if(!rows.length)throw Error('Account no longer exists');
   return this.profile(rows[0].id);
  },
  async profile(id){
   const rows=await sql`SELECT p.id,p.played,p.wins,
    COALESCE((SELECT jsonb_agg(r ORDER BY r.ended_at DESC,r.match_id DESC)
     FROM (SELECT ended_at,outcome,kills,deaths,match_id FROM harbor.recent
      WHERE profile_id=p.id ORDER BY ended_at DESC,match_id DESC LIMIT 20) r),'[]'::jsonb) AS recent
    FROM harbor.profiles p JOIN neon_auth."user" u ON u.id::text=p.subject WHERE p.id=${id}::uuid`;
   return rows.length?publicProfile(rows[0]):null;
  },
  async write(event){
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
    ), history AS (
     INSERT INTO harbor.recent(profile_id,match_id,ended_at,outcome,kills,deaths)
     SELECT id,${event.matchId}::uuid,${event.endedAt},${row.outcome},${row.kills},${row.deaths} FROM totals RETURNING profile_id
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
