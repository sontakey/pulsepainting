# Community gallery storage

The community API runs as Vercel Node functions. It uses the project's Neon
Postgres database and public Vercel Blob store; it does not receive raw PPG
samples, capture timestamps, renderer seeds, or debug reports.

Required server-only environment variables:

- `DATABASE_URL`: pooled Neon connection string.
- `DATABASE_URL_UNPOOLED`: direct connection string, used only by migrations.
- `BLOB_READ_WRITE_TOKEN`: the Pulse Painting store credential.
- `COMMUNITY_RATE_SECRET`: at least 32 random characters for source hashing.
- `COMMUNITY_NAMESPACE`: optional explicit namespace. Otherwise `VERCEL_ENV`
  separates production and preview, and local development uses `development`.

Keep all credentials in ignored env files or Vercel environment settings.
Never put them in app assets or build-time client variables.

## Migration and verification

Apply the versioned schema to an isolated Neon branch first:

```sh
node --env-file=.env.community.local db/migrate.mjs
COMMUNITY_TEST_DATABASE=1 node --env-file=.env.community.local test/community-api.mjs
```

The integration test creates a random `smoke-*` namespace, uses real Postgres
and Blob storage, and removes its rows and test rasters afterward. It rejects
the production namespace/environment. The local env file must point to the
isolated database branch. With no integration flag, the test only runs boundary
validation and raster-normalization checks.

Run `db/migrate.mjs` separately against the production direct connection only
when releasing this backend. Builds and API requests never run migrations.

## Publication contract

`POST /api/paintings` accepts only `id`, `ownerToken`, `image`, `displayName`,
`includeMetrics`, `metrics`, and `consentVersion: 1`. The client must save its
random UUID and 32-byte random removal capability before sending the request.
Keep the same fields on retry; different content with the same ID is rejected.
The capability is never returned by public APIs, embedded in links, or stored
as plaintext by the server. It authorizes removal only.

The image is plain base64 PNG/JPEG, at most 2 MiB and 3 million decoded pixels.
The server strips metadata, flattens transparency, and creates a 1080×1350 JPEG
plus WebP thumbnail. The image itself is public. The client renders a fresh
publication image honoring the metrics choice before upload. This API cannot
prove the physiological origin or semantic contents of a submitted raster.

An optional name is limited to 50 characters. The only permitted metrics are
`hr`, `rmssd`, and `sdnn`; they must be null unless explicitly opted in. These
are descriptive values with no medical classifications. Consent is recorded
with its version and publication time. Public responses expose only ID, name,
opted-in metrics, image/thumbnail URLs, canonical link, and publication time.

List: `GET /api/paintings?limit=24&cursor=...` (limit 1–48).
Detail: `GET /api/paintings?id=<uuid>`.
Public share page: `/p/<uuid>`, with the actual painting in Open Graph metadata.
Removal: `DELETE /api/paintings?id=<uuid>` with `{ "ownerToken": "..." }`.
Report: `POST /api/painting-report` with ID and one of `inappropriate`,
`privacy`, `spam`, or `other`.

## Abuse controls and moderation

Publication attempts are capped at 30 per source/hour and 500 globally/hour.
New paintings are capped at 3 per source/hour, 15 per source/day, 200 globally
per day, and 2,000 published or pending paintings per namespace. Reports are
capped at 10 per source/hour and 300 globally/hour. Counters are atomic database
operations. Source identifiers use a daily HMAC; raw IP addresses are neither
stored nor logged by this application. Reports are deduplicated for the same
painting/source/day and do not automatically hide art.

Moderation is manual in this MVP. Operators should review reports regularly:

```sh
node --env-file=<private-env> tools/community-admin.mjs reports
node --env-file=<private-env> tools/community-admin.mjs hide <painting-uuid>
node --env-file=<private-env> tools/community-admin.mjs cleanup
```

For a production env file that does not include `VERCEL_ENV`, prefix these
commands with `COMMUNITY_NAMESPACE=production`. Check the namespace printed
by the command; a local env file otherwise defaults to `development` even if
its database connection points to the production branch. Preview uses
`COMMUNITY_NAMESPACE=preview`.

Removal/hide immediately removes the database entry from public reads and
clears its name/metrics. A tombstone prevents an old upload retry from
republishing it. The original public images are deleted on a best-effort basis;
`cleanup` retries deletion, expires abandoned uploads, prunes old rate buckets,
and removes abandoned upload attempts without touching current published
images. It is scoped to this application's namespace and Blob prefixes.

Public API/HTML caches last at most 30 seconds; Blob propagation/cache copies
can last at least 60 seconds. Already downloaded copies cannot be recalled.
The UI therefore says "Remove from gallery", not "erase everywhere". If the
user loses the local removal capability, they can report the painting for an
operator to review. There are no accounts or public administrator routes.
