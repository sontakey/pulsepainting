// Artwork-first sharing, inspired by Mobbin's WHOOP, Duolingo and Rodeo
// share sheets. The system share sheet chooses apps; this page never posts.
(() => {
  'use strict';
  const HOME = 'https://www.pulsepainting.com/';
  const RUNTIME_BASE = new URL('.', document.currentScript?.src || location.href);
  const BLOB_HOST = 'hnexw2ri5lomm3rg.public.blob.vercel-storage.com';
  const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const PUBLIC_PATH = new RegExp(`^/p/${UUID}$`, 'i');
  const BLOB_PATH = new RegExp(`^/community/[a-z0-9-]{1,48}/${UUID}/${UUID}/painting\\.(?:jpg|png)$`, 'i');
  let active = null;
  const icons = {
    x: '<path d="m5 4 14 16M19 4 5 20M4 4h5l11 16h-5Z"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/>',
    tiktok: '<path d="M14 3v12.5a4.5 4.5 0 1 1-4-4.47M14 3c.8 4 2.8 5 6 5v4c-2.2 0-4.3-.8-6-2.3"/>',
    linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 10v7m4 0v-7m0 3c0-4 6-4 6 0v4"/><circle cx="7" cy="7" r=".8" fill="currentColor" stroke="none"/>',
    facebook: '<path d="M14.5 21V13h3l.5-4h-3.5V7c0-1 .5-1.5 1.5-1.5h2V2.3A22 22 0 0 0 15 2c-3 0-5 1.8-5 5v2H7v4h3v8"/>',
    whatsapp: '<path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.8a8.5 8.5 0 1 1 16.3-3.7Z"/><path d="M8 7c-1 2 .5 5 3 7s4 1 5 0l-2-2-1.5 1c-1.5-.7-2.5-1.7-3-3L10 9Z"/>',
    share: '<path d="M12 15V3m-4 4 4-4 4 4M6 10H4v10h16V10h-2"/>',
    save: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
    link: '<path d="m10 14 4-4M8.5 15.5l-1 1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0m1 9a3.5 3.5 0 0 0 5 0l4-4a3.5 3.5 0 0 0-5-5l-1 1"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    book: '<path d="M12 6c-3-2-6-2-10-1v14c4-1 7-1 10 1m0-14c3-2 6-2 10-1v14c-4-1-7-1-10 1m0-14v14"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
  };
  const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
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
    active = null; state.closed = true; state.controller.abort(); state.paper?.destroy();
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
    const bookURL = publishedURL ? publishedURL.replace('/p/', '/book/') : null;
    const canPublish = typeof options.onPublish === 'function';
    const title = safeText(options.title, 'Pulse Painting', 100);
    const suppliedCaption = safeText(options.caption, `My pulse painted this place. Three minutes, one landscape. Make yours: ${link} #PulsePainting`);
    const caption = suppliedCaption.includes(link) ? suppliedCaption : `${suppliedCaption}\n${link}`;
    const dialog = document.createElement('dialog');
    dialog.className = 'pulse-share-sheet';
    dialog.setAttribute('aria-labelledby', 'pulse-share-title');
    dialog.innerHTML = `<div class="ps-shell">
      <header class="ps-header"><div><p class="ps-eyebrow">A little piece of you</p><h2 id="pulse-share-title">Share your painting.</h2><p class="ps-intro">Your pulse made this. Let it travel.</p></div><button type="button" class="ps-close" aria-label="Close sharing">${svg('close')}</button></header>
      <div class="ps-body"><figure class="ps-art"><div class="ps-preview"><img alt="Your finished Pulse Painting" hidden><span class="ps-loading">Preparing your painting…</span></div><figcaption>Made by a heartbeat. Yours.</figcaption></figure>
      <div class="ps-options"><p class="ps-section-label">Send a little wonder</p><div class="ps-platforms">
      ${[['x','X'],['instagram','Instagram'],['tiktok','TikTok'],['linkedin','LinkedIn'],['facebook','Facebook'],['whatsapp','WhatsApp']].map(([id, label]) => ['instagram','tiktok'].includes(id)
        ? `<button type="button" class="ps-platform ps-${id}" data-platform="${id}" disabled><span>${svg(id)}</span>${label}</button>`
        : `<a class="ps-platform ps-${id}" data-platform="${id}" target="_blank" rel="noopener noreferrer"><span>${svg(id)}</span>${label}</a>`).join('')}
      </div><p class="ps-platform-note">Instagram & TikTok use your phone’s share sheet, or a saved image. Other buttons share a link.</p>
      <div class="ps-link-card"><span class="ps-link-dot" aria-hidden="true"></span><div><strong class="ps-link-title"></strong><p class="ps-link-description"></p><button type="button" class="ps-publish" hidden>Give your painting a public page <span aria-hidden="true"><svg class="ui-arrow" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 19 19 5M5 5h14v14"/></svg></span></button></div></div>
      <div class="ps-utilities"><button type="button" data-action="copy-link">${svg('link')}<span>Copy link</span></button><button type="button" data-action="save" disabled>${svg('save')}<span>Save image</span></button><button type="button" data-action="copy-caption">${svg('copy')}<span>Copy caption</span></button></div>
      <details class="ps-caption"><summary>Your caption <span aria-hidden="true">+</span></summary><p></p></details>
      <button type="button" class="ps-paper-toggle" aria-expanded="false" aria-controls="pulse-share-paper" disabled>${svg('book')}<span><strong>Open your sketchbook</strong><small>Your painting, a little closer</small></span><span aria-hidden="true"><svg class="ui-arrow" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 19 19 5M5 5h14v14"/></svg></span></button><div class="ps-book-links" hidden><button type="button" class="ps-book-link"></button><p class="ps-book-note"></p></div></div>
      <section class="ps-paper" id="pulse-share-paper" aria-labelledby="pulse-share-paper-title" hidden><header><div><h3 id="pulse-share-paper-title">Your pulse, on paper.</h3><p>A sketchbook made from this painting.</p></div><button type="button" class="ps-paper-close" aria-label="Close your sketchbook">${svg('close')}</button></header><p class="ps-paper-context">Turn the pages to see the whole painting and its details.</p><div class="ps-paper-stage"></div><p class="ps-paper-status" role="status" aria-live="polite">Opening your sketchbook…</p><p class="ps-paper-credit">Page-turning adapted from <a href="https://threeui.com/css/sketchbook" target="_blank" rel="noopener noreferrer">ThreeUI by Meng To</a>.</p></section></div>
      <footer class="ps-footer"><p class="ps-status" role="status" aria-live="polite">Preparing your image…</p><button type="button" class="ps-share" disabled>${svg('share')}<span>Share image</span></button><p class="ps-footer-note">Choose the app and audience. Nothing posts automatically.</p></footer>
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
      dialog.querySelector('.ps-paper-toggle').disabled = !state.file;
      dialog.querySelectorAll('[data-action="save"],button[data-platform]').forEach(button => { button.disabled = !state.file || state.sharing; });
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
    const shareImage = platform => {
      if (!state.file || state.closed || state.sharing) return;
      if (!canShareImage()) {
        download();
        if (platform) announce(`Save the image, then add it in ${platform}. Use Copy caption for your words and link.`);
        return;
      }
      state.sharing = true; readyButtons();
      const data = { files: [state.file], title };
      // Deliberately no awaited work here: the prepared file reaches the native
      // share API in the same trusted click, preserving Safari's user gesture.
      try {
        const result = navigator.share(data);
        Promise.resolve(result).then(() => announce(platform ? `Returned from sharing. You can also copy the caption for ${platform}.` : 'Returned from sharing. Your painting is ready whenever you are.')).catch(error => {
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
        announce(copied ? success : 'Copying is unavailable. Expand Your caption to select its text.');
      };
      try {
        if (!navigator.clipboard?.writeText) { fallback(); return; }
        navigator.clipboard.writeText(text).then(() => announce(success)).catch(() => { if (!state.closed) fallback(); });
      } catch { fallback(); }
    };
    const revealBookLink = () => {
      if (!bookURL || state.closed) return;
      const field = dialog.querySelector('.ps-book-url');
      field.hidden = false; field.value = bookURL; field.focus({ preventScroll: true }); field.select(); field.scrollIntoView({ block: 'nearest' });
      // Keep a selectable link visible even when clipboard permission is denied.
      try {
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(bookURL)
          .then(() => announce('Sketchbook link copied. Anyone with the link can turn its pages.'))
          .catch(() => announce('Select and copy the sketchbook link below.'));
        else announce('Select and copy the sketchbook link below.');
      } catch { announce('Select and copy the sketchbook link below.'); }
    };
    const shareBook = () => {
      if (state.closed || state.sharing) return;
      if (!bookURL) { if (canPublish) { close(); options.onPublish({ intent: 'sketchbook' }); } return; }
      if (typeof navigator.share !== 'function') { revealBookLink(); return; }
      state.sharing = true; readyButtons();
      try {
        Promise.resolve(navigator.share({ title: 'A Pulse Painting sketchbook', text: 'Turn the pages of a landscape painted by a pulse.', url: bookURL }))
          .then(() => announce('Your sketchbook link is ready to travel.'))
          .catch(error => { if (error?.name === 'AbortError') announce(''); else revealBookLink(); })
          .finally(() => { state.sharing = false; readyButtons(); });
      } catch (error) { state.sharing = false; readyButtons(); if (error?.name === 'AbortError') announce(''); else revealBookLink(); }
    };
    const bookLinks = dialog.querySelector('.ps-book-links');
    const bookActionLabel = bookURL ? 'Share sketchbook link' : 'Create a sketchbook link';
    bookLinks.hidden = !bookURL && !canPublish;
    dialog.querySelector('.ps-book-link').textContent = bookActionLabel;
    dialog.querySelector('.ps-book-link').addEventListener('click', shareBook);
    dialog.querySelector('.ps-book-note').textContent = bookURL
      ? 'A link opens straight into this painting’s book. No recording needed.'
      : 'Review what becomes public first. Creating a link also adds your painting to the community gallery.';
    const bookActions = document.createElement('div'); bookActions.className = 'ps-paper-links';
    bookActions.hidden = !bookURL && !canPublish;
    bookActions.innerHTML = '<button type="button" class="ps-paper-link"></button><button type="button" class="ps-book-copy" hidden>Copy sketchbook link</button><input class="ps-book-url" aria-label="Sketchbook link to copy" type="url" readonly hidden>';
    bookActions.querySelector('.ps-paper-link').textContent = bookActionLabel;
    bookActions.querySelector('.ps-paper-link').addEventListener('click', shareBook);
    const bookCopy = bookActions.querySelector('.ps-book-copy'); bookCopy.hidden = !bookURL; bookCopy.addEventListener('click', revealBookLink);
    // A fallback URL lives outside the collapsed paper section so it is always reachable.
    bookLinks.append(bookActions.querySelector('.ps-book-url'));
    dialog.querySelector('.ps-paper').append(bookActions);
    const encoded = encodeURIComponent;
    const destinations = {
      x: `https://x.com/intent/tweet?text=${encoded(caption.replace(link, '').trim())}&url=${encoded(link)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded(link)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encoded(link)}`,
      whatsapp: `https://wa.me/?text=${encoded(caption.includes(link) ? caption : `${caption}\n${link}`)}`,
    };
    Object.entries(destinations).forEach(([name, href]) => { dialog.querySelector(`[data-platform="${name}"]`).href = href; });
    dialog.querySelector('.ps-art figcaption').textContent = publishedURL ? 'A real pulse. A painting with its own public page.' : 'Private painting · link buttons share the app';
    dialog.querySelector('.ps-link-title').textContent = publishedURL ? 'A page for this painting' : 'Your image stays private';
    dialog.querySelector('.ps-link-description').textContent = publishedURL ? 'Link buttons open this painting’s public page, with its chosen details.' : 'Link buttons invite friends to the app. Sharing an image does not add it to the gallery.';
    dialog.querySelector('[data-action="copy-link"] span').textContent = publishedURL ? 'Copy link' : 'Copy app link';
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
    dialog.querySelector('[data-platform="instagram"]').addEventListener('click', () => shareImage('Instagram'));
    dialog.querySelector('[data-platform="tiktok"]').addEventListener('click', () => shareImage('TikTok'));
    dialog.querySelector('[data-action="save"]').addEventListener('click', download);
    dialog.querySelector('[data-action="copy-link"]').addEventListener('click', () => copy(link, publishedURL ? 'Painting link copied.' : 'App link copied. Your painting has not been published.'));
    dialog.querySelector('[data-action="copy-caption"]').addEventListener('click', () => copy(caption, 'Caption copied. Add it to your post.'));
    const paperPanel = dialog.querySelector('.ps-paper'), paperToggle = dialog.querySelector('.ps-paper-toggle'), paperStatus = dialog.querySelector('.ps-paper-status');
    let paperGeneration = 0;
    const closePaper = () => {
      paperGeneration++; state.paper?.destroy(); state.paper = null;
      paperPanel.hidden = true; paperToggle.setAttribute('aria-expanded', 'false');
      paperToggle.focus({ preventScroll: true });
    };
    const openPaper = async () => {
      if (!paperPanel.hidden) { closePaper(); return; }
      const generation = ++paperGeneration;
      paperPanel.hidden = false; paperToggle.setAttribute('aria-expanded', 'true');
      if (!state.blob) return;
      paperStatus.textContent = 'Opening your sketchbook…';
      paperPanel.scrollIntoView({ block: 'start', behavior: 'auto' });
      try {
        // Only this prepared image reaches the optional, locally composed book.
        // Original Singapore plates and private recording data are never used.
        const { mountPulseSketchbook } = await import(new URL('sketchbook-entry.js', RUNTIME_BASE).href);
        if (state.closed || generation !== paperGeneration) return;
        state.paper = mountPulseSketchbook(dialog.querySelector('.ps-paper-stage'), { blob: state.blob });
        const loaded = await state.paper.ready;
        if (state.closed || generation !== paperGeneration) return;
        paperStatus.textContent = loaded ? 'Drag or tap a page to turn it. Use the zoom controls for a closer look.' : 'The sketchbook could not finish opening. Close it and try again. Your painting is ready to share.';
        dialog.querySelector('.ps-paper-close').focus({ preventScroll: true });
      } catch {
        if (!state.closed && generation === paperGeneration) paperStatus.textContent = 'Your sketchbook could not open. Close it and try again. Your painting is ready to share.';
      }
    };
    paperToggle.addEventListener('click', openPaper);
    dialog.querySelector('.ps-paper-close').addEventListener('click', closePaper);
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
        announce(canShareImage() ? 'Ready to share with your favorite apps.' : 'Save your painting, then add it to your favorite app.');
        if (options.openBook === true && publishedURL) openPaper();
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
