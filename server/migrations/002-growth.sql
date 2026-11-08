SELECT pg_advisory_xact_lock(618321,2);
-- Additive migration. Existing official results are deliberately not backfilled.
CREATE TABLE IF NOT EXISTS harbor.growth (
 profile_id uuid PRIMARY KEY REFERENCES harbor.profiles(id) ON DELETE CASCADE,
 xp bigint NOT NULL DEFAULT 0 CHECK(xp>=0 AND xp<=9007199254740991)
);
CREATE TABLE IF NOT EXISTS harbor.growth_runs (
 id uuid PRIMARY KEY,
 profile_id uuid NOT NULL REFERENCES harbor.profiles(id) ON DELETE CASCADE,
 mode text NOT NULL CHECK(mode IN ('duel','ffa','survival')),
 difficulty text NOT NULL CHECK(difficulty IN ('easy','normal','hard','auto')),
 started_at bigint NOT NULL,
 xp smallint CHECK(xp BETWEEN 0 AND 800)
);
CREATE INDEX IF NOT EXISTS growth_runs_owner ON harbor.growth_runs(profile_id);
ALTER TABLE harbor.growth ENABLE ROW LEVEL SECURITY;
ALTER TABLE harbor.growth_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON harbor.growth,harbor.growth_runs FROM PUBLIC;
CREATE TABLE IF NOT EXISTS harbor.growth_epoch (
 single boolean PRIMARY KEY DEFAULT true CHECK(single),
 started_at bigint NOT NULL DEFAULT (extract(epoch FROM clock_timestamp())*1000)::bigint
);
INSERT INTO harbor.growth_epoch(single) VALUES(true) ON CONFLICT DO NOTHING;
ALTER TABLE harbor.growth_epoch ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON harbor.growth_epoch FROM PUBLIC;
