import { CANONICAL_ORIGIN, CommunityError, getCommunityService } from '../server/community.js';
import { query } from '../server/http.js';
import { paintingPage, sketchbookPage } from '../server/painting-page-view.js';

const paintingPolicy = "default-src 'none'; img-src https://hnexw2ri5lomm3rg.public.blob.vercel-storage.com; font-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
// The separately scoped book uses the preserved renderer's opaque srcdoc frame.
// That authored document has inline script/styles and locally composed PNGs.
// User-provided strings remain escaped HTML text, never executable source.
const bookPolicy = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://hnexw2ri5lomm3rg.public.blob.vercel-storage.com; connect-src 'self' blob: https://hnexw2ri5lomm3rg.public.blob.vercel-storage.com; font-src 'self'; frame-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', paintingPolicy);
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); throw new CommunityError(405, 'method_not_allowed', 'Method not allowed.'); }
    const params = query(req), book = params.view === 'book';
    if (params.view !== undefined && !book) throw new CommunityError(400, 'invalid_request', 'Unknown painting view.');
    if (book) res.setHeader('Content-Security-Policy', bookPolicy);
    const painting = await getCommunityService().get(params.id);
    res.statusCode = 200; res.setHeader('Cache-Control', book ? 'no-store' : 'public, max-age=0, s-maxage=30, must-revalidate');
    if (req.method === 'HEAD') return res.end();
    return res.end(book ? sketchbookPage(painting, CANONICAL_ORIGIN) : paintingPage(painting, CANONICAL_ORIGIN));
  } catch (error) {
    const status = error instanceof CommunityError ? error.status : 503;
    res.statusCode = status; res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'HEAD') return res.end();
    const text = status === 410 ? 'This painting is no longer in the gallery.' : status === 404 || status === 400 ? 'This painting could not be found.' : 'The gallery is temporarily unavailable.';
    res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Pulse Painting</title><body><h1>${text}</h1><a href="${CANONICAL_ORIGIN}/#landscapes">Explore Pulse Painting</a></body></html>`);
  }
}
