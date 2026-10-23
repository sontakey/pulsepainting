// A public recipient receives only the already-published painting image.
// No camera, recording, local publication receipt or removal key is accessed.
const CANONICAL = 'https://www.pulsepainting.com';
const BLOB_HOST = 'hnexw2ri5lomm3rg.public.blob.vercel-storage.com';
const host = document.querySelector('.public-book');
const stage = document.getElementById('public-book-stage');
const paper = document.querySelector('.book-paper');
const fallback = document.getElementById('public-book-fallback');
const status = document.getElementById('public-book-status');
const retry = document.getElementById('public-book-retry');
const share = document.getElementById('share-public-book');
const copyArea = document.getElementById('book-copy-fallback');
const linkInput = document.getElementById('book-link');
const shareStatus = document.getElementById('book-share-status');
const id = host?.dataset.paintingId || '';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let generation = 0, controller = null, book = null, pageActive = true, reloadForRetry = false;
const canonical = `${CANONICAL}/book/${id}`;

function imageURL() {
  const value = new URL(fallback.querySelector('img').src);
  if (value.protocol !== 'https:' || value.hostname !== BLOB_HOST || value.username || value.password || value.port || value.search || value.hash
    || !new RegExp(`^/community/(?:production|preview|[a-z0-9-]+)/${id}/[a-f0-9-]{36}/painting\\.jpg$`, 'i').test(value.pathname)) throw new Error('This painting could not be loaded.');
  return value.href;
}
function dispose() {
  generation++; controller?.abort(); controller = null; book?.destroy(); book = null;
}
async function openBook() {
  if (!pageActive) return;
  dispose(); const current = generation, abort = new AbortController(); controller = abort;
  let timedOut = false, moduleFailed = false, timeout;
  reloadForRetry = false;
  const stopped = new Promise((_, reject) => {
    abort.signal.addEventListener('abort', () => reject(new Error('Book preparation stopped.')), { once: true });
    timeout = setTimeout(() => { timedOut = true; abort.abort(); }, 45_000);
  });
  stage.setAttribute('aria-busy', 'true'); paper.classList.remove('ready'); paper.classList.add('loading'); retry.hidden = true;
  status.textContent = 'Opening this sketchbook…';
  try {
    const ready = await Promise.race([stopped, (async () => {
      const url = imageURL();
      const entry = import('./sketchbook-entry.js').catch(error => { moduleFailed = true; throw error; });
      const [module, response] = await Promise.all([entry, fetch(url, { signal: abort.signal, mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error' })]);
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/jpeg')) throw new Error('The painting could not be loaded.');
      const blob = await response.blob();
      if (!blob.size || blob.size > 3 * 1024 * 1024) throw new Error('The painting could not be loaded.');
      if (current !== generation || abort.signal.aborted) return false;
      const mounted = module.mountPulseSketchbook(stage, { blob }); book = mounted;
      return mounted.ready;
    })()]);
    if (current !== generation || abort.signal.aborted) return;
    if (!ready) throw new Error('The sketchbook could not be opened.');
    stage.setAttribute('aria-busy', 'false'); paper.classList.remove('loading'); paper.classList.add('ready');
    status.textContent = 'Drag or tap a page to turn. Use the zoom controls for a closer look.';
    // Keep the complete book above the mobile action dock on short displays.
    // The title remains just above it in the same scrollable document.
    const dock = document.querySelector('.book-actions'), rect = stage.getBoundingClientRect();
    if (getComputedStyle(dock).position === 'fixed' && rect.bottom > dock.getBoundingClientRect().top) {
      const top = Math.max(12, (dock.getBoundingClientRect().top - rect.height) / 2);
      scrollTo({ top: Math.max(0, scrollY + rect.top - top), behavior: 'instant' });
    }
  } catch (error) {
    if (current !== generation || (abort.signal.aborted && !timedOut)) return;
    abort.abort(); book?.destroy(); book = null; stage.setAttribute('aria-busy', 'false'); paper.classList.remove('loading', 'ready');
    reloadForRetry = moduleFailed;
    status.textContent = 'The book could not open just now. You can still enjoy and share the complete painting.'; retry.hidden = false;
  } finally { clearTimeout(timeout); }
}
function revealCopy(message) {
  copyArea.hidden = false; linkInput.value = canonical; shareStatus.textContent = message;
  linkInput.focus({ preventScroll: true }); linkInput.select(); copyArea.scrollIntoView({ block: 'center', behavior: 'instant' });
}
async function copyLink() {
  try { await navigator.clipboard.writeText(canonical); revealCopy('Sketchbook link copied. Send a little world to someone.'); }
  catch { revealCopy('Select and copy this link to share the sketchbook.'); }
}
async function shareBook() {
  if (navigator.share) {
    try { await navigator.share({ title: document.title, text: 'Turn the pages of this pulse painting.', url: canonical }); return; }
    catch (error) { if (error?.name === 'AbortError') return; }
  }
  await copyLink();
}
if (uuid.test(id) && stage && fallback) {
  share.hidden = false; share.addEventListener('click', shareBook);
  document.getElementById('copy-public-book').addEventListener('click', copyLink);
  // Browsers cache rejected module imports for the lifetime of the document.
  retry.addEventListener('click', () => { if (pageActive) { if (reloadForRetry) location.reload(); else openBook(); } });
  addEventListener('pagehide', () => { pageActive = false; dispose(); });
  addEventListener('pageshow', event => { if (event.persisted) { pageActive = true; openBook(); } });
  openBook();
}
