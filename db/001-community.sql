BEGIN;

CREATE TABLE IF NOT EXISTS community_paintings (
  namespace text NOT NULL CHECK (namespace ~ '^[a-z0-9-]{1,48}$'),
  id uuid NOT NULL,
  owner_hash char(64) NOT NULL,
  payload_hash char(64) NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'published', 'failed', 'removed')),
  display_name text NOT NULL DEFAULT '' CHECK (char_length(display_name) <= 50),
  metrics jsonb,
  consent_version integer NOT NULL CHECK (consent_version = 1),
  consented_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  lease uuid,
  lease_until timestamptz,
  storage_prefix text,
  image_url text,
  thumbnail_url text,
  byte_size integer NOT NULL DEFAULT 0 CHECK (byte_size >= 0),
  removed_at timestamptz,
  PRIMARY KEY (namespace, id)
);
CREATE INDEX IF NOT EXISTS community_paintings_published
  ON community_paintings (namespace, published_at DESC, id DESC)
  WHERE status = 'published';
CREATE INDEX IF NOT EXISTS community_paintings_cleanup
  ON community_paintings (namespace, status, lease_until);

CREATE TABLE IF NOT EXISTS community_rate_buckets (
  namespace text NOT NULL,
  bucket text NOT NULL,
  period_start timestamptz NOT NULL,
  hits integer NOT NULL CHECK (hits > 0),
  PRIMARY KEY (namespace, bucket, period_start)
);
CREATE INDEX IF NOT EXISTS community_rate_buckets_expiry ON community_rate_buckets (period_start);

CREATE TABLE IF NOT EXISTS community_reports (
  namespace text NOT NULL,
  painting_id uuid NOT NULL,
  source_hash char(64) NOT NULL,
  reason text NOT NULL CHECK (reason IN ('inappropriate', 'privacy', 'spam', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  PRIMARY KEY (namespace, painting_id, source_hash),
  FOREIGN KEY (namespace, painting_id) REFERENCES community_paintings (namespace, id)
);
CREATE INDEX IF NOT EXISTS community_reports_unreviewed
  ON community_reports (namespace, created_at) WHERE reviewed_at IS NULL;

COMMIT;
