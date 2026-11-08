SELECT pg_advisory_xact_lock(618321,4);
ALTER TABLE harbor.recent ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'duel';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='harbor.recent'::regclass AND conname='recent_multiplayer_bounds') THEN
  ALTER TABLE harbor.recent DROP CONSTRAINT IF EXISTS recent_kills_check;
  ALTER TABLE harbor.recent DROP CONSTRAINT IF EXISTS recent_deaths_check;
  ALTER TABLE harbor.recent ADD CONSTRAINT recent_multiplayer_bounds CHECK(kills BETWEEN 0 AND 10000 AND deaths BETWEEN 0 AND 10000 AND mode IN ('duel','ffa','team'));
 END IF;
END $$;
