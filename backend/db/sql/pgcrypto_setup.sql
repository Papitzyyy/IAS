-- Optional: PostgreSQL encryption at rest (PRD — AES-256 via pgcrypto).
-- Requires PostgreSQL (not SQLite). Set FIELD_ENCRYPTION_KEY in .env before use.
--
-- This script enables the extension and documents the pattern.
-- Full column encryption migration can be added in a future release.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Example (do not run blindly on production without a migration plan):
-- ALTER TABLE students ADD COLUMN contact_number_enc BYTEA;
-- UPDATE students SET contact_number_enc = pgp_sym_encrypt(contact_number, 'your-key');
-- Application reads via pgp_sym_decrypt(contact_number_enc, 'your-key')::text;
