-- Add challenge_xdr column to wallet_challenges for SEP-10-style verification.
-- The challenge transaction XDR is stored so the server can verify the signed TX.
ALTER TABLE public.wallet_challenges
  ADD COLUMN IF NOT EXISTS challenge_xdr TEXT;

-- Also ensure nonce can accept text (hex string) in addition to bytea.
-- The existing column is bytea, but our service stores hex strings.
-- We'll use a new text column and keep the old one for backward compat.
ALTER TABLE public.wallet_challenges
  ADD COLUMN IF NOT EXISTS nonce_hex TEXT;
