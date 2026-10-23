import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';
import { attachDatabasePool } from '@vercel/functions';
import { put, del, list as listBlobs } from '@vercel/blob';

export const CANONICAL_ORIGIN = 'https://www.pulsepainting.com';
export const BLOB_HOST = 'hnexw2ri5lomm3rg.public.blob.vercel-storage.com';
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const REPORT_REASONS = Object.freeze(['inappropriate', 'privacy', 'spam', 'other']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TOKEN = /^[0-9a-f]{64}$/;
const HASH = /^[0-9a-f]{64}$/;
const hash = value => createHash('sha256').update(value).digest('hex');
const defaults = Object.freeze({ attemptsPerHour: 30, attemptsGlobalPerHour: 500, postsPerHour: 3, postsPerDay: 15, postsGlobalPerDay: 200, livePaintings: 2000, reportsPerHour: 10, reportsGlobalPerHour: 300 });
const publicColumns = 'id, display_name, metrics, image_url, thumbnail_url, published_at';

export class CommunityError extends Error {
  constructor(status, code, message, retryAfter = null) { super(message); this.status = status; this.code = code; this.retryAfter = retryAfter; }
}
const invalid = message => new CommunityError(400, 'invalid_request', message);
export function plainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
export function allowKeys(value, keys) {
  if (!plainObject(value) || Object.keys(value).some(key => !keys.includes(key))) throw invalid('Unexpected request fields.');
}
export function validateID(id) { if (typeof id !== 'string' || !UUID.test(id)) throw invalid('Invalid painting ID.'); return id; }
function validateToken(token) { if (typeof token !== 'string' || !TOKEN.test(token)) throw invalid('Invalid removal key.'); return token; }
function sameHash(a, b) { return HASH.test(a || '') && HASH.test(b || '') && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')); }

export function validatePublication(body) {
  allowKeys(body, ['id', 'ownerToken', 'image', 'displayName', 'includeMetrics', 'metrics', 'consentVersion']);
  const id = validateID(body.id), ownerToken = validateToken(body.ownerToken);
  if (body.consentVersion !== 1) throw invalid('Confirm the public sharing notice before publishing.');
  if (typeof body.includeMetrics !== 'boolean') throw invalid('Choose whether to include summary metrics.');
  if (typeof body.displayName !== 'string') throw invalid('Use a display name or leave it blank.');
  const displayName = body.displayName.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if ([...displayName].length > 50 || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(displayName)) throw invalid('Use a display name of up to 50 characters.');
  let metrics = null;
  if (!body.includeMetrics) {
    if (body.metrics !== null) throw invalid('Metrics must be omitted when sharing is off.');
  } else {
    allowKeys(body.metrics, ['hr', 'rmssd', 'sdnn']);
    metrics = {};
    for (const key of ['hr', 'rmssd', 'sdnn']) {
      const value = body.metrics[key] ?? null;
      // Display/storage bounds, not a physiological interpretation.
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 9999)) throw invalid('Invalid summary metric.');
      metrics[key] = value === null ? null : Math.round(value * 100) / 100;
    }
    if (Object.values(metrics).every(value => value === null)) metrics = null;
  }
  if (typeof body.image !== 'string' || body.image.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.image)) throw invalid('Use a PNG or JPEG painting smaller than 2 MB.');
  const bytes = Buffer.from(body.image, 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== body.image) throw invalid('Invalid painting image.');
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!png && !jpeg) throw invalid('Only PNG and JPEG paintings are accepted.');
  const payloadHash = hash(JSON.stringify({ displayName, metrics, includeMetrics: body.includeMetrics, consentVersion: 1, image: hash(bytes) }));
  return { id, ownerHash: hash(ownerToken), payloadHash, displayName, metrics, bytes };
}

export async function normalizePainting(bytes) {
  try {
    const source = sharp(bytes, { limitInputPixels: 3_000_000, animated: false, failOn: 'warning' });
    const meta = await source.metadata();
    if (!['png', 'jpeg'].includes(meta.format) || (meta.pages || 1) !== 1 || meta.width < 64 || meta.height < 64 || meta.width > 2700 || meta.height > 2700) throw new Error('Invalid dimensions');
    const image = await source.rotate().flatten({ background: '#fdfbf7' }).resize(1080, 1350, { fit: 'contain', background: '#fdfbf7' }).toColorspace('srgb').jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    const thumbnail = await sharp(image).resize({ width: 640 }).webp({ quality: 84 }).toBuffer();
    return { image, thumbnail };
  } catch { throw invalid('This image could not be read. Prepare the painting again.'); }
}

function namespaceFromEnvironment() {
  const value = process.env.COMMUNITY_NAMESPACE || process.env.VERCEL_ENV || 'development';
  if (!/^[a-z0-9-]{1,48}$/.test(value)) throw new CommunityError(503, 'not_configured', 'The gallery is temporarily unavailable.');
  return value;
}
export const vercelBlobStorage = {
  async put(path, bytes, contentType) { return put(path, bytes, { access: 'public', contentType, addRandomSuffix: false, allowOverwrite: false, cacheControlMaxAge: 60 }); },
  async delete(urls) { if (urls.length) await del(urls); },
  async list(prefix) {
    const found = []; let cursor;
    do { const page = await listBlobs({ prefix, cursor, limit: 100 }); found.push(...page.blobs.map(blob => blob.url)); cursor = page.hasMore ? page.cursor : undefined; } while (cursor && found.length < 1000);
    return found;
  },
};
let singleton;
export function getCommunityService() {
  if (singleton) return singleton;
  if (!process.env.DATABASE_URL || !process.env.BLOB_READ_WRITE_TOKEN || !process.env.COMMUNITY_RATE_SECRET || process.env.COMMUNITY_RATE_SECRET.length < 32) throw new CommunityError(503, 'not_configured', 'The community gallery is not available yet. Please try again later.');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 15000, idleTimeoutMillis: 5000, allowExitOnIdle: true });
  attachDatabasePool(pool);
  pool.on('error', () => { console.error('Community database connection failed.'); });
  singleton = createCommunityService({ pool, storage: vercelBlobStorage, namespace: namespaceFromEnvironment(), rateSecret: process.env.COMMUNITY_RATE_SECRET });
  return singleton;
}

export function createCommunityService({ pool, storage: media, namespace, rateSecret, limits: overrides = {} }) {
  if (!/^[a-z0-9-]{1,48}$/.test(namespace) || typeof rateSecret !== 'string' || rateSecret.length < 32) throw new Error('Invalid community service configuration.');
  const limits = { ...defaults, ...overrides };
  const actor = source => createHmac('sha256', rateSecret).update(`${new Date().toISOString().slice(0,10)}:${String(source || 'unknown')}`).digest('hex');
  const prefixFor = id => `community/${namespace}/${id}/`;
  const validMedia = (url, prefix) => {
    try { const parsed = new URL(url); return parsed.protocol === 'https:' && parsed.hostname === BLOB_HOST && !parsed.username && !parsed.password && !parsed.search && !parsed.hash && parsed.pathname.startsWith('/' + prefix); } catch { return false; }
  };
  function publicPainting(row) {
    if (!validMedia(row.image_url, prefixFor(row.id)) || !validMedia(row.thumbnail_url, prefixFor(row.id))) throw new CommunityError(503, 'unavailable', 'This painting is temporarily unavailable.');
    return { id: row.id, displayName: row.display_name, metrics: row.metrics, imageURL: row.image_url, thumbnailURL: row.thumbnail_url, url: `${CANONICAL_ORIGIN}/p/${row.id}`, createdAt: new Date(row.published_at).toISOString() };
  }
  async function transaction(fn) {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }
  }
  async function lock(client, key) { await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`pulsepainting:${namespace}:${key}`]); }
  async function quota(client, bucket, duration, maximum) {
    const period = new Date(Math.floor(Date.now() / duration) * duration);
    const result = await client.query(`INSERT INTO community_rate_buckets(namespace,bucket,period_start,hits) VALUES($1,$2,$3,1)
      ON CONFLICT(namespace,bucket,period_start) DO UPDATE SET hits=community_rate_buckets.hits+1 WHERE community_rate_buckets.hits<$4 RETURNING hits`, [namespace, bucket, period, maximum]);
    if (!result.rowCount) throw new CommunityError(429, 'rate_limited', 'Please wait before sharing another painting.', Math.max(1, Math.ceil((+period + duration - Date.now()) / 1000)));
  }
  async function throttle(source, operation) {
    const key = actor(source);
    await transaction(async client => {
      const report = operation === 'report';
      await quota(client, `${operation}:global`, 3600000, report ? limits.reportsGlobalPerHour : limits.attemptsGlobalPerHour);
      await quota(client, `${operation}:${key}`, 3600000, report ? limits.reportsPerHour : limits.attemptsPerHour);
    });
    return key;
  }
  async function cleanURLs(urls) {
    try { await media.delete(urls.filter(Boolean)); return true; } catch { return false; }
  }
  async function reserveLiveCapacity(client) {
    // Both first attempts and failed-attempt retries enter the live set.
    // Serialize them against the same ceiling without charging retry quotas.
    await lock(client, 'publication-quota');
    const count = (await client.query("SELECT count(*)::int AS count FROM community_paintings WHERE namespace=$1 AND status IN ('published','pending')", [namespace])).rows[0].count;
    if (count >= limits.livePaintings) throw new CommunityError(503, 'gallery_capacity', 'The gallery is taking a short pause on new paintings. Your artwork is still yours to save and share.');
  }
  async function publish(body, source) {
    const input = validatePublication(body), sourceHash = await throttle(source, 'publish-attempt');
    const lease = randomUUID(), storagePrefix = `${prefixFor(input.id)}${lease}/`;
    const reserved = await transaction(async client => {
      await lock(client, input.id);
      const current = (await client.query('SELECT * FROM community_paintings WHERE namespace=$1 AND id=$2 FOR UPDATE', [namespace, input.id])).rows[0];
      if (current) {
        if (!sameHash(input.ownerHash, current.owner_hash)) throw new CommunityError(404, 'not_found', 'Painting not found.');
        if (current.status === 'removed') throw new CommunityError(410, 'removed', 'This painting has been removed.');
        if (!sameHash(input.payloadHash, current.payload_hash)) throw new CommunityError(409, 'publication_conflict', 'This publication already has different details.');
        if (current.status === 'published') return { painting: publicPainting(current), created: false };
        if (current.status === 'pending' && +new Date(current.lease_until) > Date.now()) throw new CommunityError(409, 'publication_pending', 'Your painting is still being published. Try again shortly.', 5);
        if (current.status === 'failed') await reserveLiveCapacity(client);
        await client.query(`UPDATE community_paintings SET status='pending',lease=$3,lease_until=now()+interval '5 minutes',storage_prefix=$4 WHERE namespace=$1 AND id=$2`, [namespace, input.id, lease, storagePrefix]);
      } else {
        // Serialize the new-publication ceiling with the daily global quota.
        await reserveLiveCapacity(client);
        await quota(client, 'publish:global', 86400000, limits.postsGlobalPerDay);
        await quota(client, `publish:${sourceHash}`, 3600000, limits.postsPerHour);
        await quota(client, `publish-day:${sourceHash}`, 86400000, limits.postsPerDay);
        await client.query(`INSERT INTO community_paintings(namespace,id,owner_hash,payload_hash,status,display_name,metrics,consent_version,lease,lease_until,storage_prefix)
          VALUES($1,$2,$3,$4,'pending',$5,$6,1,$7,now()+interval '5 minutes',$8)`, [namespace, input.id, input.ownerHash, input.payloadHash, input.displayName, input.metrics, lease, storagePrefix]);
      }
      return null;
    });
    if (reserved) return reserved;
    const uploaded = [];
    try {
      const { image, thumbnail } = await normalizePainting(input.bytes);
      const full = await media.put(storagePrefix + 'painting.jpg', image, 'image/jpeg'); uploaded.push(full.url);
      if (!validMedia(full.url, storagePrefix)) throw new Error('Unexpected storage location.');
      const thumb = await media.put(storagePrefix + 'thumbnail.webp', thumbnail, 'image/webp'); uploaded.push(thumb.url);
      if (!validMedia(thumb.url, storagePrefix)) throw new Error('Unexpected storage location.');
      const completed = await pool.query(`UPDATE community_paintings SET status='published',published_at=date_trunc('milliseconds',clock_timestamp()),lease=NULL,lease_until=NULL,image_url=$4,thumbnail_url=$5,byte_size=$6
        WHERE namespace=$1 AND id=$2 AND status='pending' AND lease=$3 RETURNING ${publicColumns}`, [namespace, input.id, lease, full.url, thumb.url, image.length + thumbnail.length]);
      if (!completed.rowCount) throw new CommunityError(409, 'publication_changed', 'This painting was removed or retried before publishing completed.');
      return { painting: publicPainting(completed.rows[0]), created: true };
    } catch (error) {
      // An UPDATE can commit even when its acknowledgement is lost. Reconcile
      // under the publication lock before deleting any potentially live image.
      // If the database is unavailable, keep the files for retry/operator cleanup.
      const reconciled = await transaction(async client => {
        await lock(client, input.id);
        const current = (await client.query('SELECT * FROM community_paintings WHERE namespace=$1 AND id=$2 FOR UPDATE', [namespace, input.id])).rows[0];
        if (current?.status === 'published') {
          if (!sameHash(input.ownerHash, current.owner_hash) || !sameHash(input.payloadHash, current.payload_hash)) throw error;
          return { painting: publicPainting(current), keep: [current.image_url, current.thumbnail_url] };
        }
        if (current?.status === 'pending' && current.lease === lease) {
          await client.query("UPDATE community_paintings SET status='failed',lease=NULL,lease_until=NULL WHERE namespace=$1 AND id=$2", [namespace, input.id]);
        }
        return null;
      });
      await cleanURLs(uploaded.filter(url => !reconciled?.keep.includes(url)));
      if (reconciled) return { painting: reconciled.painting, created: true };
      throw error;
    }
  }
  async function get(id) {
    validateID(id);
    const result = await pool.query(`SELECT ${publicColumns},status FROM community_paintings WHERE namespace=$1 AND id=$2`, [namespace, id]);
    const row = result.rows[0];
    if (!row || !['published', 'removed'].includes(row.status)) throw new CommunityError(404, 'not_found', 'Painting not found.');
    if (row.status === 'removed') throw new CommunityError(410, 'removed', 'This painting is no longer in the gallery.');
    return publicPainting(row);
  }
  async function list({ cursor = null, limit = 24 } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 48) throw invalid('Invalid gallery page size.');
    let before = null;
    if (cursor !== null) {
      try {
        if (typeof cursor !== 'string' || cursor.length > 250 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
        before = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        if (!Array.isArray(before) || before.length !== 2 || typeof before[0] !== 'string' || !Number.isFinite(Date.parse(before[0]))) throw new Error();
        validateID(before[1]);
      } catch { throw invalid('Invalid gallery page.'); }
    }
    const rows = (await pool.query(`SELECT ${publicColumns} FROM community_paintings WHERE namespace=$1 AND status='published'
      ${before ? 'AND (published_at,id) < ($3::timestamptz,$4::uuid)' : ''} ORDER BY published_at DESC,id DESC LIMIT $2`, before ? [namespace, limit + 1, ...before] : [namespace, limit + 1])).rows;
    const hasMore = rows.length > limit, selected = rows.slice(0, limit), last = selected.at(-1);
    return { paintings: selected.map(publicPainting), nextCursor: hasMore ? Buffer.from(JSON.stringify([new Date(last.published_at).toISOString(), last.id])).toString('base64url') : null };
  }
  async function remove(id, body) {
    validateID(id); allowKeys(body, ['ownerToken']); const ownerHash = hash(validateToken(body.ownerToken));
    const row = await transaction(async client => {
      await lock(client, id);
      const current = (await client.query('SELECT owner_hash,image_url,thumbnail_url FROM community_paintings WHERE namespace=$1 AND id=$2 FOR UPDATE', [namespace, id])).rows[0];
      if (!current || !sameHash(ownerHash, current.owner_hash)) throw new CommunityError(404, 'not_found', 'The removal key does not match this painting.');
      await client.query("UPDATE community_paintings SET status='removed',removed_at=COALESCE(removed_at,now()),display_name='',metrics=NULL,lease=NULL,lease_until=NULL WHERE namespace=$1 AND id=$2", [namespace, id]);
      return current;
    });
    const cleaned = await cleanURLs([row.image_url, row.thumbnail_url]);
    return { removed: true, cleanupPending: !cleaned };
  }
  async function report(body, source) {
    allowKeys(body, ['id', 'reason']); const id = validateID(body.id);
    if (!REPORT_REASONS.includes(body.reason)) throw invalid('Choose a report reason.');
    const sourceHash = await throttle(source, 'report');
    const row = await pool.query(`INSERT INTO community_reports(namespace,painting_id,source_hash,reason)
      SELECT $1,id,$3,$4 FROM community_paintings WHERE namespace=$1 AND id=$2 AND status='published'
      ON CONFLICT(namespace,painting_id,source_hash) DO NOTHING RETURNING painting_id`, [namespace, id, sourceHash, body.reason]);
    if (!row.rowCount) {
      const exists = (await pool.query("SELECT 1 FROM community_paintings WHERE namespace=$1 AND id=$2 AND status='published'", [namespace, id])).rowCount;
      if (!exists) throw new CommunityError(404, 'not_found', 'Painting not found.');
    }
    return { reported: true };
  }
  async function reports() {
    return (await pool.query(`SELECT r.painting_id AS id,r.reason,r.created_at,p.display_name AS "displayName",p.status
      FROM community_reports r JOIN community_paintings p ON p.namespace=r.namespace AND p.id=r.painting_id
      WHERE r.namespace=$1 AND r.reviewed_at IS NULL ORDER BY r.created_at LIMIT 100`, [namespace])).rows;
  }
  async function hide(id) {
    validateID(id);
    const row = await transaction(async client => {
      await lock(client, id);
      const current = (await client.query(`UPDATE community_paintings SET status='removed',removed_at=COALESCE(removed_at,now()),display_name='',metrics=NULL,lease=NULL,lease_until=NULL
        WHERE namespace=$1 AND id=$2 RETURNING image_url,thumbnail_url`, [namespace, id])).rows[0];
      if (!current) throw new CommunityError(404, 'not_found', 'Painting not found.');
      await client.query('UPDATE community_reports SET reviewed_at=now() WHERE namespace=$1 AND painting_id=$2', [namespace, id]);
      return current;
    });
    return { removed: true, cleanupPending: !await cleanURLs([row.image_url, row.thumbnail_url]) };
  }
  async function cleanup({ cursor = null } = {}) {
    // Only this application's namespace and server-owned prefixes are touched.
    // Include published rows to collect abandoned attempts while retaining the
    // two current images. A cursor keeps old tombstones from starving cleanup.
    if (cursor !== null) validateID(cursor);
    const rows = (await pool.query('SELECT id FROM community_paintings WHERE namespace=$1 AND ($2::uuid IS NULL OR id>$2::uuid) ORDER BY id LIMIT 101', [namespace, cursor])).rows;
    const candidates = rows.slice(0, 100);
    let cleaned = 0;
    for (const { id } of candidates) {
      await transaction(async client => {
        await lock(client, id);
        const row = (await client.query('SELECT status,lease_until,image_url,thumbnail_url FROM community_paintings WHERE namespace=$1 AND id=$2 FOR UPDATE', [namespace, id])).rows[0];
        if (!row || (row.status === 'pending' && +new Date(row.lease_until) >= Date.now())) return;
        if (row.status === 'pending') await client.query("UPDATE community_paintings SET status='failed',lease=NULL,lease_until=NULL WHERE namespace=$1 AND id=$2", [namespace, id]);
        const urls = await media.list(prefixFor(id));
        if (urls.some(url => !validMedia(url, prefixFor(id)))) throw new Error('Unexpected cleanup path.');
        const stale = row.status === 'published' ? urls.filter(url => url !== row.image_url && url !== row.thumbnail_url) : urls;
        if (stale.length) { await media.delete(stale); cleaned += stale.length; }
      });
    }
    const expired = await pool.query("DELETE FROM community_rate_buckets WHERE namespace=$1 AND period_start < now()-interval '3 days'", [namespace]);
    await pool.query("DELETE FROM community_reports WHERE namespace=$1 AND reviewed_at < now()-interval '30 days'", [namespace]);
    return { cleaned, expiredRateBuckets: expired.rowCount, nextCursor: rows.length > 100 ? candidates.at(-1).id : null };
  }
  return Object.freeze({ publish, get, list, remove, report, reports, hide, cleanup, namespace });
}
