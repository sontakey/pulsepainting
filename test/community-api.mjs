// Pure boundary checks always run. Real persistence checks explicitly require
// COMMUNITY_TEST_DATABASE=1 and an isolated, non-production namespace/env file.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import pg from 'pg';
import sharp from 'sharp';
import { BLOB_HOST, CommunityError, createCommunityService, normalizePainting, validatePublication, vercelBlobStorage } from '../server/community.js';
import { checkOrigin, readJSON, MAX_BODY_BYTES } from '../server/http.js';

const image = (await readFile(new URL('../app/assets/gallery/quiet-lake-share.jpg', import.meta.url))).toString('base64');
const newBody = (options = {}) => ({ id: randomUUID(), ownerToken: randomBytes(32).toString('hex'), image, displayName: '', includeMetrics: false, metrics: null, consentVersion: 1, ...options });
const input = newBody();
assert.equal(validatePublication(input).metrics, null);
assert.equal(validatePublication({ ...input, displayName: '  One   rhythm  ' }).displayName, 'One rhythm');
for (const bad of [
  { ...input, samples: [1, 2, 3] }, { ...input, startedAt: '2026-01-01' }, { ...input, seed: 1 },
  { ...input, metrics: { hr: 60 } }, { ...input, consentVersion: 0 }, { ...input, ownerToken: 'short' },
  { ...input, includeMetrics: true, metrics: { hr: Infinity } }, { ...input, includeMetrics: true, metrics: { hr: -1 } },
  { ...input, includeMetrics: true, metrics: { rr: [] } }, { ...input, displayName: 'x'.repeat(51) },
  { ...input, displayName: 'unsafe\u202e' }, { ...input, image: 'data:image/jpeg;base64,' + image },
  { ...input, image: Buffer.from('<svg/>').toString('base64') },
]) assert.throws(() => validatePublication(bad), error => error instanceof CommunityError && error.status === 400);
const opted = validatePublication({ ...input, includeMetrics: true, metrics: { hr: 67.123, rmssd: 42, sdnn: null } });
assert.deepEqual(opted.metrics, { hr: 67.12, rmssd: 42, sdnn: null });
const normalized = await normalizePainting(Buffer.from(image, 'base64'));
const metadata = await sharp(normalized.image).metadata();
assert.equal(metadata.format, 'jpeg'); assert.equal(metadata.width, 1080); assert.equal(metadata.height, 1350);
assert.equal(metadata.exif, undefined); assert.equal(metadata.xmp, undefined);
await assert.rejects(() => normalizePainting(Buffer.from([255, 216, 255, 0])), error => error.status === 400);
const bomb = await sharp({ create: { width: 2000, height: 2000, channels: 3, background: '#fff' } }).png().toBuffer();
await assert.rejects(() => normalizePainting(bomb), error => error.status === 400);
assert.throws(() => checkOrigin({ headers: { origin: 'https://evil.invalid', host: 'evil.invalid' } }), error => error.status === 403);
await assert.rejects(() => readJSON({ headers: { 'content-type': 'application/json', 'content-length': String(MAX_BODY_BYTES + 1) } }), error => error.status === 413);
await assert.rejects(() => readJSON({ headers: { 'content-type': 'application/json' }, body: 'not json' }), error => error.status === 400);
console.log('PASS community boundary: strict consent/metadata allowlist, bounded raster normalization, metadata stripping and origin/body guards');

if (process.env.COMMUNITY_TEST_DATABASE !== '1') {
  console.log('Real community persistence checks require COMMUNITY_TEST_DATABASE=1 with the isolated database env.');
  process.exit(0);
}
if (!process.env.DATABASE_URL || !process.env.COMMUNITY_RATE_SECRET || !process.env.BLOB_READ_WRITE_TOKEN || process.env.COMMUNITY_NAMESPACE === 'production' || process.env.VERCEL_ENV === 'production') throw new Error('Use an isolated community database environment, never production.');
const namespace = `smoke-${randomUUID().slice(0, 18)}`;
process.env.COMMUNITY_NAMESPACE = namespace;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 15000, allowExitOnIdle: true });
const base = { pool, namespace, rateSecret: process.env.COMMUNITY_RATE_SECRET, storage: vercelBlobStorage, limits: { postsPerHour: 20, postsPerDay: 30, postsGlobalPerDay: 50 } };
const service = createCommunityService(base);
const created = new Set(); let server;
try {
  const body = newBody({ displayName: '<b>Test painting</b>', includeMetrics: true, metrics: { hr: 67, rmssd: 42, sdnn: 38 } }); created.add(body.id);
  const first = await service.publish(body, 'test-source');
  assert.equal(first.created, true); assert.deepEqual(first.painting.metrics, body.metrics);
  assert.equal(new URL(first.painting.imageURL).hostname, BLOB_HOST);
  assert.deepEqual(Object.keys(first.painting).sort(), ['createdAt','displayName','id','imageURL','metrics','thumbnailURL','url'].sort());
  const response = await fetch(first.painting.imageURL); assert.equal(response.status, 200);
  const publicImage = await response.arrayBuffer(); assert.ok(publicImage.byteLength > 1000);
  assert.equal((await sharp(Buffer.from(publicImage)).metadata()).format, 'jpeg');
  const repeat = await service.publish(body, 'test-source'); assert.equal(repeat.created, false); assert.deepEqual(repeat.painting, first.painting);
  await assert.rejects(() => service.publish({ ...body, displayName: 'changed' }, 'test-source'), error => error.code === 'publication_conflict');
  await assert.rejects(() => service.remove(body.id, { ownerToken: randomBytes(32).toString('hex') }), error => error.status === 404);
  assert.deepEqual(await service.report({ id: body.id, reason: 'privacy' }, 'report-source'), { reported: true });
  await service.report({ id: body.id, reason: 'spam' }, 'report-source');
  assert.equal((await service.reports()).length, 1, 'reports deduplicate without hiding the painting');
  assert.equal((await service.get(body.id)).id, body.id);

  const anonymous = newBody(); created.add(anonymous.id); const second = await service.publish(anonymous, 'test-source-2');
  assert.equal(second.painting.displayName, ''); assert.equal(second.painting.metrics, null);
  const page1 = await service.list({ limit: 1 }); assert.equal(page1.paintings.length, 1); assert.ok(page1.nextCursor);
  const page2 = await service.list({ limit: 1, cursor: page1.nextCursor }); assert.equal(page2.paintings.length, 1); assert.notEqual(page1.paintings[0].id, page2.paintings[0].id);
  await assert.rejects(() => service.list({ cursor: 'invalid' }), error => error.status === 400);

  // Inject only the storage failure; the state machine and constraints use the real database.
  const retryBody = newBody(); created.add(retryBody.id); let puts = 0, deleted = [];
  const failing = createCommunityService({ ...base, storage: { ...vercelBlobStorage,
    put: async (...args) => { if (++puts === 2) throw new Error('Injected upload failure'); return vercelBlobStorage.put(...args); },
    delete: async urls => { deleted.push(...urls); await vercelBlobStorage.delete(urls); },
  } });
  await assert.rejects(() => failing.publish(retryBody, 'retry-source'));
  assert.equal(deleted.length, 1, 'partially uploaded raster is cleaned');
  await assert.rejects(() => service.get(retryBody.id), error => error.status === 404);
  const capacityBeforeRetry = (await pool.query("SELECT count(*)::int AS count FROM community_paintings WHERE namespace=$1 AND status IN ('published','pending')", [namespace])).rows[0].count;
  const publicationQuota = async () => (await pool.query("SELECT sum(hits)::int AS count FROM community_rate_buckets WHERE namespace=$1 AND bucket='publish:global'", [namespace])).rows[0].count;
  const quotaBeforeRetry = await publicationQuota();
  const retryAtCapacity = createCommunityService({ ...base, limits: { ...base.limits, livePaintings: capacityBeforeRetry } });
  await assert.rejects(() => retryAtCapacity.publish(retryBody, 'retry-source'), error => error.code === 'gallery_capacity');
  assert.equal((await pool.query('SELECT status FROM community_paintings WHERE namespace=$1 AND id=$2', [namespace, retryBody.id])).rows[0].status, 'failed', 'capacity rejection keeps failed upload outside the live set');
  const retried = await service.publish(retryBody, 'retry-source'); assert.equal(retried.painting.id, retryBody.id);
  assert.equal(await publicationQuota(), quotaBeforeRetry, 'neither a blocked nor successful retry charges the new-publication quota twice');

  // Simulate a database commit whose acknowledgement is lost. A successful
  // publication must keep its images and reconcile to the same public receipt.
  const uncertainBody = newBody(); created.add(uncertainBody.id); let lostAck = false, uncertainDeletes = 0;
  const uncertain = createCommunityService({ ...base,
    pool: { connect: (...args) => pool.connect(...args), query: async (...args) => {
      const result = await pool.query(...args);
      if (!lostAck && String(args[0]).startsWith("UPDATE community_paintings SET status='published'")) { lostAck = true; throw new Error('Injected lost commit acknowledgement'); }
      return result;
    } },
    storage: { ...vercelBlobStorage, delete: async urls => { uncertainDeletes += urls.length; await vercelBlobStorage.delete(urls); } },
  });
  const reconciled = await uncertain.publish(uncertainBody, 'uncertain-source');
  assert.ok(lostAck); assert.equal(uncertainDeletes, 0); assert.equal(reconciled.painting.id, uncertainBody.id);
  assert.equal((await fetch(reconciled.painting.imageURL)).status, 200);
  assert.deepEqual((await service.publish(uncertainBody, 'uncertain-source')).painting, reconciled.painting);
  const orphan = await vercelBlobStorage.put(`community/${namespace}/${uncertainBody.id}/${randomUUID()}/painting.jpg`, normalized.image, 'image/jpeg');
  const collected = [];
  const cleaner = createCommunityService({ ...base, storage: { ...vercelBlobStorage, delete: async urls => { collected.push(...urls); await vercelBlobStorage.delete(urls); } } });
  await cleaner.cleanup();
  assert.ok(collected.includes(orphan.url), 'operator cleanup removes abandoned upload attempts');
  assert.ok(!collected.includes(reconciled.painting.imageURL), 'operator cleanup preserves the published raster');
  assert.ok(!collected.includes(reconciled.painting.thumbnailURL), 'operator cleanup preserves the published thumbnail');

  let releasePut, putStarted;
  const held = new Promise(resolve => { releasePut = resolve; }); const started = new Promise(resolve => { putStarted = resolve; });
  const delayed = createCommunityService({ ...base, storage: { ...vercelBlobStorage, put: async (...args) => { putStarted(); await held; return vercelBlobStorage.put(...args); } } });
  const raceBody = newBody(); created.add(raceBody.id);
  const pending = delayed.publish(raceBody, 'race-source'); await started;
  await assert.rejects(() => service.publish(raceBody, 'race-source'), error => error.code === 'publication_pending');
  await service.remove(raceBody.id, { ownerToken: raceBody.ownerToken }); releasePut();
  await assert.rejects(() => pending, error => error.code === 'publication_changed');
  await assert.rejects(() => service.get(raceBody.id), error => error.status === 410);

  const capped = createCommunityService({ ...base, limits: { ...base.limits, livePaintings: 0 } });
  await assert.rejects(() => capped.publish(newBody(), 'capacity-source'), error => error.code === 'gallery_capacity');
  const limited = createCommunityService({ ...base, limits: { ...base.limits, attemptsPerHour: 1 } });
  await limited.publish(body, 'limited-source');
  await assert.rejects(() => limited.publish(body, 'limited-source'), error => error.status === 429);

  // Exercise the actual generic handlers against the same real storage/database.
  const [{ default: paintings }, { default: report }, { default: page }] = await Promise.all([import('../api/paintings.js'), import('../api/painting-report.js'), import('../api/painting-page.js')]);
  server = createServer((req, res) => {
    const parsed = new URL(req.url, 'http://localhost'); req.query = Object.fromEntries(parsed.searchParams);
    const handler = parsed.pathname === '/api/paintings' ? paintings : parsed.pathname === '/api/painting-report' ? report : page;
    handler(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const publicDetail = await fetch(`${origin}/api/paintings?id=${body.id}`); assert.equal(publicDetail.status, 200);
  const detailText = await publicDetail.text(); assert.ok(!detailText.includes(body.ownerToken)); assert.ok(!detailText.includes('owner_hash'));
  const og = await fetch(`${origin}/api/painting-page?id=${body.id}`); assert.equal(og.status, 200); const html = await og.text();
  assert.ok(html.includes('&lt;b&gt;Test painting&lt;/b&gt;')); assert.ok(!html.includes('<b>Test painting</b>')); assert.ok(html.includes(first.painting.imageURL)); assert.ok(!html.includes(body.ownerToken));
  const blocked = await fetch(`${origin}/api/paintings`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.invalid' }, body: JSON.stringify(body) }); assert.equal(blocked.status, 403); assert.equal(blocked.headers.get('cache-control'), 'no-store');
  const httpDelete = await fetch(`${origin}/api/paintings?id=${body.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ ownerToken: body.ownerToken }) }); assert.equal(httpDelete.status, 200);
  const removedPage = await fetch(`${origin}/api/painting-page?id=${body.id}`);
  assert.equal(removedPage.status, 410); assert.equal(removedPage.headers.get('cache-control'), 'no-store');
  const removedHTML = await removedPage.text(); assert.ok(removedHTML.includes('noindex')); assert.ok(!removedHTML.includes('property="og:image"'));
  const removedHead = await fetch(`${origin}/api/painting-page?id=${body.id}`, { method: 'HEAD' });
  assert.equal(removedHead.status, 410); assert.equal(await removedHead.text(), '');
  const unknownPage = await fetch(`${origin}/api/painting-page?id=${randomUUID()}`);
  assert.equal(unknownPage.status, 404); assert.equal(unknownPage.headers.get('cache-control'), 'no-store'); assert.ok(!(await unknownPage.text()).includes('property="og:image"'));
  assert.deepEqual(await service.remove(body.id, { ownerToken: body.ownerToken }), { removed: true, cleanupPending: false });
  await assert.rejects(() => service.publish(body, 'test-source'), error => error.status === 410);
  const erased = (await pool.query('SELECT display_name,metrics FROM community_paintings WHERE namespace=$1 AND id=$2', [namespace, body.id])).rows[0]; assert.equal(erased.display_name, ''); assert.equal(erased.metrics, null);
  await service.hide(anonymous.id); assert.equal((await service.reports()).length, 1);
  await service.hide(body.id); assert.equal((await service.reports()).length, 0);
  console.log('PASS community persistence: real Neon/Blob publication, public image, idempotency, pagination, retry cleanup, lost commit acknowledgement, concurrent removal, quotas, reports, OG escaping and owner removal');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  for (const id of created) await service.hide(id).catch(() => {});
  await service.cleanup();
  await pool.query('DELETE FROM community_reports WHERE namespace=$1', [namespace]);
  await pool.query('DELETE FROM community_paintings WHERE namespace=$1', [namespace]);
  await pool.query('DELETE FROM community_rate_buckets WHERE namespace=$1', [namespace]);
  await pool.end();
}
