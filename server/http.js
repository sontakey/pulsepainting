import { CommunityError, CANONICAL_ORIGIN, plainObject } from './community.js';

export const MAX_BODY_BYTES = 3 * 1024 * 1024;
const header = (req, key) => { const value = req.headers?.[key]; return typeof value === 'string' ? value : ''; };
export function query(req) {
  const result = Object.fromEntries(new URL(req.url, CANONICAL_ORIGIN).searchParams);
  for (const [key, value] of Object.entries(req.query || {})) {
    if (typeof value !== 'string') throw new CommunityError(400, 'invalid_request', 'Invalid query parameter.');
    result[key] = value;
  }
  return result;
}
export function checkOrigin(req) {
  const origin = header(req, 'origin');
  const allowed = new Set([CANONICAL_ORIGIN]);
  for (const value of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) if (value && /^[a-z0-9.-]+\.vercel\.app$/i.test(value)) allowed.add(`https://${value}`);
  if (!process.env.VERCEL && /^http:\/\/(?:127\.0\.0\.1|localhost):\d{1,5}$/.test(origin)) return;
  if (!allowed.has(origin)) throw new CommunityError(403, 'origin_rejected', 'Open Pulse Painting to publish or manage a painting.');
}
export function sourceFor(req) {
  // Vercel overwrites this incoming header. Local servers use the peer socket.
  return process.env.VERCEL ? header(req, 'x-forwarded-for').split(',')[0].trim() || 'unknown' : req.socket?.remoteAddress || 'local';
}
export async function readJSON(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(header(req, 'content-type'))) throw new CommunityError(415, 'unsupported_type', 'Use a JSON request.');
  const size = header(req, 'content-length');
  if (size && (!/^\d+$/.test(size) || Number(size) > MAX_BODY_BYTES)) throw new CommunityError(413, 'request_too_large', 'The painting is too large to publish.');
  try {
    // Vercel supplies a parsed body getter; the local server supplies a stream.
    const parsed = req.body;
    if (parsed !== undefined) {
      const raw = Buffer.isBuffer(parsed) ? parsed.toString('utf8') : typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
      if (Buffer.byteLength(raw) > MAX_BODY_BYTES) throw new CommunityError(413, 'request_too_large', 'The painting is too large to publish.');
      const body = typeof parsed === 'string' || Buffer.isBuffer(parsed) ? JSON.parse(raw) : parsed;
      if (!plainObject(body)) throw new Error();
      return body;
    }
    let bytes = 0; const chunks = [];
    for await (const chunk of req) { bytes += chunk.length; if (bytes > MAX_BODY_BYTES) throw new CommunityError(413, 'request_too_large', 'The painting is too large to publish.'); chunks.push(chunk); }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!plainObject(body)) throw new Error();
    return body;
  } catch (error) {
    if (error instanceof CommunityError) throw error;
    throw new CommunityError(400, 'invalid_request', 'The request could not be read.');
  }
}
export function json(res, status, body, { cache = false } = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache ? 'public, max-age=0, s-maxage=30, must-revalidate' : 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}
export function errorResponse(res, error) {
  const known = error instanceof CommunityError;
  if (!known) console.error('Community request failed.', { code: typeof error?.code === 'string' ? error.code : 'internal' });
  if (known && error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
  json(res, known ? error.status : 503, { error: known ? error.message : 'The gallery is temporarily unavailable. Please try again.', code: known ? error.code : 'unavailable' });
}
export const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
