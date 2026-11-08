-- Run inside the server migration transaction; existing profiles choose a nickname on first online entry.
SELECT pg_advisory_xact_lock(618321,5);
ALTER TABLE harbor.profiles ADD COLUMN IF NOT EXISTS nickname varchar(16);
