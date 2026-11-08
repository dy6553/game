SELECT pg_advisory_xact_lock(618321,3);
CREATE TABLE IF NOT EXISTS harbor.admin_members (
 profile_id uuid PRIMARY KEY REFERENCES harbor.profiles(id) ON DELETE CASCADE,
 granted_at bigint NOT NULL DEFAULT (extract(epoch FROM clock_timestamp())*1000)::bigint
);
CREATE TABLE IF NOT EXISTS harbor.admin_level_edits (
 request_id uuid PRIMARY KEY,
 actor_id uuid REFERENCES harbor.profiles(id) ON DELETE SET NULL,
 target_id uuid NOT NULL REFERENCES harbor.profiles(id) ON DELETE CASCADE,
 before_xp bigint NOT NULL CHECK(before_xp BETWEEN 0 AND 9007199254740991),
 after_xp bigint NOT NULL CHECK(after_xp BETWEEN 0 AND 9007199254740991),
 reason text NOT NULL CHECK(length(reason)<=200),
 changed_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_level_edits_target ON harbor.admin_level_edits(target_id,changed_at DESC);
CREATE INDEX IF NOT EXISTS admin_level_edits_actor ON harbor.admin_level_edits(actor_id);
ALTER TABLE harbor.admin_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE harbor.admin_level_edits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON harbor.admin_members,harbor.admin_level_edits FROM PUBLIC;
