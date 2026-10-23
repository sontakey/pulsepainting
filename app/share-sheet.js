// Prepared artwork reaches the system share sheet only on a trusted click.
// Publishing remains a separate, explicitly reviewed choice.
(() => {
  'use strict';
  const HOME = 'https://www.pulsepainting.com/';
  const BLOB_HOST = 'hnexw2ri5lomm3rg.public.blob.vercel-storage.com';
  const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const PUBLIC_PATH = new RegExp(`^/p/${UUID}$`, 'i');
  const BLOB_PATH = new RegExp(`^/community/[a-z0-9-]{1,48}/${UUID}/${UUID}/painting\\.(?:jpg|png)$`, 'i');
  let active = null;
  const icons = {
    share: '<path d="M12 15V3m-4 4 4-4 4 4M6 10H4v10h16V10h-2"/>',
    save: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
    link: '<path d="m10 14 4-4M8.5 15.5l-1 1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0m1 9a3.5 3.5 0 0 0 5 0l4-4a3.5 3.5 0 0 0-5-5l-1 1"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    arrow: '<path d="M5 19 19 5M5 5h14v14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
  };
  const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[name]}</svg>`;
  const safeText = (value, fallback, limit = 500) => typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : fallback;
  function publicLink(value) {
    if (!value) return null;
    try {
      const url = new URL(value);
      if (url.origin === new URL(HOME).origin && PUBLIC_PATH.test(url.pathname) && !url.search && !url.hash && !url.username && !url.password) return url.href;
    } catch { /* A private artwork always falls back to the app link. */ }
    return null;
  }
  function trustedImage(value) {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value, location.href);
      if (url.username || url.password || url.search || url.hash) return null;
      if (url.protocol === 'https:' && url.hostname === BLOB_HOST && !url.port && BLOB_PATH.test(url.pathname)) return url.href;
      if (url.origin === location.origin && /\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return url.href;
    } catch { /* Do not fetch untrusted or malformed image URLs. */ }
    return null;
  }
  function cleanFileName(value, type) {
    const stem = safeText(value, 'pulse-painting', 80).replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'pulse-painting';
    return `${stem}.${type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : 'png'}`;
  }
  function close() {
    const state = active;
    if (!state) return;
    active = null; state.closed = true; state.controller.abort();
    window.removeEventListener('popstate', state.onNavigate);
    window.removeEventListener('hashchange', state.onNavigate);
    if (state.url) URL.revokeObjectURL(state.url);
    state.dialog.close(); state.dialog.remove();
    document.documentElement.style.overflow = state.previousOverflow;
    if (state.returnFocus?.isConnected && state.returnFocus.getClientRects().length && !state.returnFocus.closest('[hidden]') && getComputedStyle(state.returnFocus).visibility !== 'hidden') state.returnFocus.focus({ preventScroll: true });
  }
  function open(options = {}) {
    close();
    const publishedURL = publicLink(options.publicURL), link = publishedURL || HOME;
    const title = safeText(options.title, 'Pulse Painting', 100);
    const suppliedCaption = safeText(options.caption, `My pulse painted this place. Three minutes, one landscape. Make yours: ${link} #PulsePainting`);
    const caption = suppliedCaption.includes(link) ? suppliedCaption : `${suppliedCaption}\n${link}`;
    const dialog = document.createElement('dialog');
    dialog.className = 'pulse-share-sheet';
    dialog.setAttribute('aria-labelledby', 'pulse-share-title');
    dialog.setAttribute('aria-describedby', 'pulse-share-intro');
    dialog.innerHTML = `<div class="ps-shell">
      <button type="button" class="ps-close" aria-label="Close sharing">${svg('close')}</button>
      <div class="ps-body">
        <figure class="ps-art"><div class="ps-preview"><img alt="A finished Pulse Painting" hidden><span class="ps-loading">Preparing your painting…</span></div><figcaption></figcaption></figure>
        <div class="ps-options">
          <header class="ps-header"><p class="ps-eyebrow">Your pulse, on paper</p><h2 id="pulse-share-title">Share your painting.</h2><p id="pulse-share-intro" class="ps-intro"></p></header>
          <details class="ps-caption"><summary>Caption ${svg('plus')}</summary><p></p><button type="button" data-action="copy-caption">${svg('copy')}<span>Copy caption</span></button></details>
          <button type="button" class="ps-publish" hidden><span>Add to gallery</span>${svg('arrow')}</button>
        </div>
        <footer class="ps-footer">
          <button type="button" class="ps-share" disabled>${svg('share')}<span>Share image</span></button>
          <div class="ps-utilities"><button type="button" data-action="save" disabled>${svg('save')}<span>Save image</span></button><button type="button" data-action="copy-link">${svg('link')}<span></span></button></div>
          <p class="ps-status" role="status" aria-live="polite" aria-atomic="true">Preparing your image…</p>
        </footer>
      </div>
    </div>`;
    const state = { dialog, publishedURL, title, caption, link, file: null, blob: null, url: null, closed: false, sharing: false, controller: new AbortController(), returnFocus: document.activeElement, previousOverflow: document.documentElement.style.overflow };
    active = state;
    state.onNavigate = () => { if (active === state) close(); };
    window.addEventListener('popstate', state.onNavigate);
    window.addEventListener('hashchange', state.onNavigate);
    const status = dialog.querySelector('.ps-status'), primary = dialog.querySelector('.ps-share');
    const announce = text => { if (!state.closed) status.textContent = text; };
    const readyButtons = () => {
      if (state.closed) return;
      primary.disabled = !state.file || state.sharing;
      dialog.querySelector('[data-action="save"]').disabled = !state.file || state.sharing;
    };
    const canShareImage = () => {
      try { return !!state.file && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [state.file] }); }
      catch { return false; }
    };
    const download = () => {
      if (!state.blob || state.closed) return;
      // A separate URL survives closing the dialog while the browser starts
      // its download. The preview URL is revoked immediately on close.
      const url = URL.createObjectURL(state.blob), anchor = document.createElement('a');
      anchor.href = url; anchor.download = state.file.name; anchor.rel = 'noopener';
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      announce('Image download started. You can add it to your next post.');
    };
    const shareImage = () => {
      if (!state.file || state.closed || state.sharing) return;
      if (!canShareImage()) {
        download();
        return;
      }
      state.sharing = true; readyButtons();
      const data = { files: [state.file], title };
      // Deliberately no awaited work here: the prepared file reaches the native
      // share API in the same trusted click, preserving Safari's user gesture.
      try {
        const result = navigator.share(data);
        Promise.resolve(result).then(() => announce('Returned from sharing.')).catch(error => {
          announce(error?.name === 'AbortError' ? '' : 'Image sharing is unavailable here. Save the image, then add it in your app.');
        }).finally(() => { state.sharing = false; readyButtons(); });
      } catch (error) {
        state.sharing = false; readyButtons();
        announce(error?.name === 'AbortError' ? '' : 'Image sharing is unavailable here. Save the image, then add it in your app.');
      }
    };
    const copy = (text, success) => {
      const fallback = () => {
        const input = document.createElement('textarea'); input.value = text; input.className = 'ps-copy-buffer'; input.setAttribute('aria-label', 'Text to copy');
        dialog.append(input); input.focus(); input.select();
        let copied = false;
        try { copied = document.execCommand('copy'); } catch { /* Leave a useful message if clipboard access is denied. */ }
        input.remove(); primary.focus({ preventScroll: true });
        if (copied) { announce(success); return; }
        const details = dialog.querySelector('.ps-caption');
        details.open = true; details.querySelector('summary').focus({ preventScroll: true });
        details.scrollIntoView({ block: 'nearest' });
        announce('Copying is unavailable. Select the text in Caption.');
      };
      try {
        if (!navigator.clipboard?.writeText) { fallback(); return; }
        navigator.clipboard.writeText(text).then(() => announce(success)).catch(() => { if (!state.closed) fallback(); });
      } catch { fallback(); }
    };
    dialog.querySelector('.ps-art figcaption').textContent = title;
    dialog.querySelector('.ps-intro').textContent = publishedURL ? 'Share the image or a link to this painting.' : 'Share the image, or invite someone to paint.';
    dialog.querySelector('[data-action="copy-link"] span').textContent = publishedURL ? 'Copy painting link' : 'Copy app link';
    dialog.querySelector('.ps-caption p').textContent = caption;
    const publish = dialog.querySelector('.ps-publish');
    if (!publishedURL && typeof options.onPublish === 'function') {
      publish.hidden = false;
      publish.addEventListener('click', () => { close(); options.onPublish(); });
    }
    dialog.querySelector('.ps-close').addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
    primary.addEventListener('click', () => shareImage());
    dialog.querySelector('[data-action="save"]').addEventListener('click', download);
    dialog.querySelector('[data-action="copy-link"]').addEventListener('click', () => copy(link, publishedURL ? 'Painting link copied.' : 'App link copied. Your painting has not been published.'));
    dialog.querySelector('[data-action="copy-caption"]').addEventListener('click', () => copy(caption, 'Caption copied. Add it to your post.'));
    document.body.append(dialog); document.documentElement.style.overflow = 'hidden'; dialog.showModal();
    dialog.querySelector('.ps-close').focus({ preventScroll: true });
    state.ready = (async () => {
      try {
        let blob = options.blob;
        if (!(blob instanceof Blob)) {
          const imageURL = trustedImage(options.imageURL);
          if (!imageURL) throw new Error('Untrusted artwork URL');
          const response = await fetch(imageURL, { signal: state.controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error' });
          if (!response.ok) throw new Error('Artwork could not be loaded');
          blob = await response.blob();
        }
        if (state.closed) return null;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type) || !blob.size || blob.size > 12 * 1024 * 1024) throw new Error('Invalid artwork file');
        state.blob = blob; state.file = new File([blob], cleanFileName(options.fileName, blob.type), { type: blob.type });
        state.url = URL.createObjectURL(blob);
        const image = dialog.querySelector('.ps-art img');
        image.src = state.url; image.hidden = false; dialog.querySelector('.ps-loading').hidden = true;
        readyButtons();
        if (!canShareImage()) primary.querySelector('span').textContent = 'Save image to share';
        announce(canShareImage() ? 'Ready to share.' : 'Save the image to send it from another app.');
        return state.file;
      } catch (error) {
        if (!state.closed && error?.name !== 'AbortError') {
          dialog.querySelector('.ps-loading').textContent = 'The image could not be loaded.';
          announce('Close and try again. Your painting has not changed.');
        }
        return null;
      }
    })();
    return { ready: state.ready, close: () => { if (active === state) close(); } };
  }
  const getState = () => active ? { open: true, ready: !!active.file, published: !!active.publishedURL, bytes: active.blob?.size || 0, sharing: active.sharing } : { open: false };
  window.PulseShare = Object.freeze({ open, close, getState });
})();
