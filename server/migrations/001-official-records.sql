-- Run on the selected Neon branch only, after Managed Better Auth is enabled.
BEGIN;
CREATE SCHEMA IF NOT EXISTS harbor;
CREATE TABLE IF NOT EXISTS harbor.profiles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 subject text UNIQUE NOT NULL,
 played bigint NOT NULL DEFAULT 0 CHECK (played >= 0),
 wins bigint NOT NULL DEFAULT 0 CHECK (wins >= 0 AND wins <= played)
);
-- Compact receipts survive recent-history trimming: retries must never add totals twice.
CREATE TABLE IF NOT EXISTS harbor.receipts (
 profile_id uuid REFERENCES harbor.profiles(id) ON DELETE CASCADE,
 match_id uuid NOT NULL,
 PRIMARY KEY(profile_id,match_id)
);
CREATE TABLE IF NOT EXISTS harbor.recent (
 profile_id uuid REFERENCES harbor.profiles(id) ON DELETE CASCADE,
 match_id uuid NOT NULL,
 ended_at bigint NOT NULL,
 outcome text NOT NULL CHECK (outcome IN ('win','loss')),
 kills smallint NOT NULL CHECK (kills BETWEEN 0 AND 10),
 deaths smallint NOT NULL CHECK (deaths BETWEEN 0 AND 10),
 PRIMARY KEY(profile_id,match_id)
);
CREATE INDEX IF NOT EXISTS recent_profile_time ON harbor.recent(profile_id,ended_at DESC,match_id DESC);
-- No Data API/browser access. Only the server's database role may use these tables.
ALTER TABLE harbor.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE harbor.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE harbor.recent ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA harbor FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA harbor FROM PUBLIC;
-- Managed Auth user IDs may be text or UUID: convert only for the private association.
CREATE OR REPLACE FUNCTION harbor.purge_deleted_user() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,harbor AS $$
 BEGIN DELETE FROM harbor.profiles WHERE subject=OLD.id::text; RETURN OLD; END;
 $$;
DROP TRIGGER IF EXISTS harbor_delete_records ON neon_auth."user";
CREATE TRIGGER harbor_delete_records AFTER DELETE ON neon_auth."user"
 FOR EACH ROW EXECUTE FUNCTION harbor.purge_deleted_user();
COMMIT;
