// Additive migration: existing users have no implicit consent or public visibility.
export default [
 `CREATE TABLE IF NOT EXISTS harbor.legal_choices (
  profile_id uuid PRIMARY KEY REFERENCES harbor.profiles(id) ON DELETE CASCADE,
  version text NOT NULL,accepted_at bigint NOT NULL,
  public_profile boolean NOT NULL DEFAULT false,public_changed_at bigint NOT NULL
 )`,
 `ALTER TABLE harbor.legal_choices ENABLE ROW LEVEL SECURITY`,
 `REVOKE ALL ON harbor.legal_choices FROM PUBLIC`,
];
