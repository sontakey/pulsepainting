// The shared image is a higher-resolution raster of the same persistent scene
// used during capture. Source data and the scene descriptor remain in memory;
// Personal keepsakes include summary metrics unless hidden. Gallery publication
// prepares a separate, explicitly reviewed image and metrics selection.
(() => {
  'use strict';
  const WIDTH = 1080, HEIGHT = 1350;
  const PAPER = '#fbf8f0', INK = '#193e49', BLUE = '#45646c';
  const ARTWORK = Object.freeze({ x: 56, y: 190, width: 968, height: 752 });
  const METRICS = Object.freeze({ x: 72, y: 1096, width: 936, height: 88 });
  const instances = new Map();
  let revision = 0;
  const valueLabel = value => Number.isFinite(value) ? `${Math.round(value)}` : '—';
  function durationLabel(duration) {
    const seconds = Math.max(0, Math.round(Number(duration) || 0));
    const minutes = Math.floor(seconds / 60), remainder = seconds % 60;
    return minutes ? `${minutes} min${remainder ? ` ${remainder} sec` : ''}` : `${seconds} sec`;
  }
  function dateLabel(value) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date) : '';
  }
  function sceneName(scene) {
    return window.PulseLandscape.FAMILIES.find(f => f.id === scene.family)?.name || scene.family?.name || 'Your landscape';
  }
  function artworkLayout(art, scene) {
    const source = { x: 0, y: 0, width: art.width, height: art.height };
    let content = { ...source };
    // The square scene includes its own paper margins. Trim only paper that is
    // pixel-identical to the same seeded, unpainted stock; even the faintest
    // changed pigment pixel remains inside the crop. This is done once after
    // recording, never in the live brush loop or on a metrics toggle.
    if (scene && scene.family !== 'aurora-night') {
      const paper = document.createElement('canvas'); paper.width = art.width; paper.height = art.height;
      try {
        window.PulseLandscape.render(scene, paper, { through: 0 });
        const actual = art.getContext('2d').getImageData(0, 0, art.width, art.height).data;
        const blank = paper.getContext('2d').getImageData(0, 0, art.width, art.height).data;
        let left = art.width, top = art.height, right = -1, bottom = -1;
        for (let y = 0; y < art.height; y++) for (let x = 0; x < art.width; x++) {
          const i = (y * art.width + x) * 4;
          if (actual[i] === blank[i] && actual[i + 1] === blank[i + 1] && actual[i + 2] === blank[i + 2] && actual[i + 3] === blank[i + 3]) continue;
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
        if (right >= left && bottom >= top) {
          content = { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
          const pad = Math.ceil(Math.min(art.width, art.height) * 24 / 1080);
          // Retain generous source context for sparse or unusually narrow
          // recordings. Never magnify one isolated mark into a full landscape.
          source.x = Math.max(0, Math.min(left - pad, Math.floor(art.width * .12)));
          source.y = Math.max(0, Math.min(top - pad, Math.floor(art.height * .20)));
          const endX = Math.min(art.width, Math.max(right + pad + 1, Math.ceil(art.width * .88)));
          const endY = Math.min(art.height, Math.max(bottom + pad + 1, Math.ceil(art.height * .80)));
          source.width = endX - source.x; source.height = endY - source.y;
        }
      } catch { /* Cropping is optional; keep the complete original if inspection is unavailable. */ }
      finally { paper.width = paper.height = 1; }
    }
    // One scale preserves the actual scene's aspect and every measured path.
    const scale = Math.min(ARTWORK.width / source.width, ARTWORK.height / source.height);
    const placement = { x: ARTWORK.x + (ARTWORK.width - source.width * scale) / 2,
      y: ARTWORK.y + (ARTWORK.height - source.height * scale) / 2,
      width: source.width * scale, height: source.height * scale };
    const bounds = { x: Math.floor(placement.x), y: Math.floor(placement.y),
      width: Math.ceil(placement.x + placement.width) - Math.floor(placement.x),
      height: Math.ceil(placement.y + placement.height) - Math.floor(placement.y) };
    return { source, content, placement, bounds };
  }
  // Fit actual ink bounds, including script overhangs and descenders. Shrinking
  // the font preserves its proportions; Canvas fillText(maxWidth) would squash it.
  function cardText(ctx, text, box, size, family, weight = 400, align = 'center', baseline) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `${weight} ${size}px "${family}", ${family === 'Water Brush' ? 'cursive' : 'sans-serif'}`;
    let measured = ctx.measureText(text);
    const inkWidth = measured.actualBoundingBoxLeft + measured.actualBoundingBoxRight;
    const inkHeight = measured.actualBoundingBoxAscent + measured.actualBoundingBoxDescent;
    const fit = Math.min(1, box.width / Math.max(1, inkWidth), box.height / Math.max(1, inkHeight));
    if (fit < 1) {
      size *= fit;
      ctx.font = `${weight} ${size}px "${family}", ${family === 'Water Brush' ? 'cursive' : 'sans-serif'}`;
      measured = ctx.measureText(text);
    }
    const x = align === 'left' ? box.x + measured.actualBoundingBoxLeft
      : align === 'right' ? box.x + box.width - measured.actualBoundingBoxRight
      : box.x + (box.width + measured.actualBoundingBoxLeft - measured.actualBoundingBoxRight) / 2;
    const y = baseline ?? box.y + (box.height + measured.actualBoundingBoxAscent - measured.actualBoundingBoxDescent) / 2;
    ctx.fillText(text, x, y);
  }
  function paintCard(canvas, { art, layout = artworkLayout(art), name, footerLeft = '', metrics = {}, includeMetrics = false }) {
    const ctx = canvas.getContext('2d');
    // One warm paper stock and a fine ochre frame surround the entire keepsake,
    // including its title and footer, rather than only the landscape square.
    ctx.fillStyle = '#f2e7cb'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = PAPER; ctx.fillRect(16, 16, WIDTH - 32, HEIGHT - 32);
    ctx.strokeStyle = '#d2bf91'; ctx.lineWidth = 1.5;
    ctx.strokeRect(28.75, 28.75, WIDTH - 57.5, HEIGHT - 57.5);
    const source = layout.source, destination = layout.placement;
    ctx.drawImage(art, source.x, source.y, source.width, source.height,
      destination.x, destination.y, destination.width, destination.height);
    ctx.fillStyle = INK;
    cardText(ctx, 'Pulse Painting', { x: 72, y: 64, width: 936, height: 102 }, 88, 'Water Brush');
    cardText(ctx, name, { x: 88, y: 980, width: 904, height: 76 }, 68, 'Water Brush');
    if (includeMetrics) {
      [['Pulse', metrics.hr, 'bpm'], ['RMSSD', metrics.rmssd, 'ms'], ['SDNN', metrics.sdnn, 'ms']].forEach(([label, value, unit], index) => {
        const x = 84 + index * 312;
        ctx.fillStyle = BLUE;
        cardText(ctx, label, { x, y: 1102, width: 288, height: 30 }, 30, 'DM Sans');
        const available = Number.isFinite(value) && value >= 0 && value <= 9999;
        ctx.fillStyle = INK;
        cardText(ctx, available ? `${valueLabel(value)} ${unit}` : '—', { x, y: 1138, width: 288, height: 44 }, 46, 'DM Sans', 500, 'center', 1172);
      });
    }
    ctx.strokeStyle = '#d8ccb3'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(72, 1257.5); ctx.lineTo(1008, 1257.5); ctx.stroke();
    ctx.fillStyle = BLUE;
    if (footerLeft) cardText(ctx, footerLeft, { x: 72, y: 1275, width: 434, height: 34 }, 30, 'DM Sans', 400, 'left');
    cardText(ctx, 'PulsePainting.com', { x: 540, y: 1275, width: 468, height: 34 }, 30, 'DM Sans', 500, 'right');
  }
  async function mount(container, options = {}) {
    clear(container);
    if (options.shareButton) options.shareButton.disabled = true;
    if (options.saveButton) options.saveButton.disabled = true;
    const scene = options.landscape;
    if (!scene?.strokes?.length || !window.PulseLandscape) { container.hidden = true; return null; }
    container.hidden = false;
    const section = document.createElement('section'); section.className = 'pulse-portrait';
    section.setAttribute('aria-label', 'Your pulse artwork');
    section.innerHTML = `<figure class="portrait-preview"><canvas width="1080" height="1350" role="img"></canvas><figcaption></figcaption></figure>
      <label class="portrait-options"><input type="checkbox" checked disabled><span>Show pulse and HRV metrics<small>Included in your saved and shared image. Turn off for just the painting.</small></span></label>
      <p class="portrait-status" role="status" aria-live="polite">Preparing your artwork…</p>
      <button type="button" class="portrait-retry" hidden>Try artwork again</button>`;
    container.append(section);
    const canvas = section.querySelector('canvas'), checkbox = section.querySelector('input');
    const share = options.shareButton, save = options.saveButton, status = section.querySelector('.portrait-status'), retry = section.querySelector('.portrait-retry');
    const name = sceneName(scene), duration = durationLabel(scene.usableSeconds), date = dateLabel(options.startedAt);
    section.querySelector('figcaption').textContent = `Made from ${duration} of accepted pulse. Your original waveform is in the menu.`;
    const state = { canvas, section, scene, options, revision: ++revision, includeMetrics: true, blob: null, file: null, sharing: false, renderVersion: 0, disposed: false, urls: new Set() };
    const syncActions = () => {
      if (share) share.disabled = !state.file || state.sharing || state.disposed;
      if (save) save.disabled = !state.blob || state.disposed;
    };
    syncActions(); instances.set(container, state);
    const failed = () => {
      if (state.disposed) return;
      checkbox.disabled = true; retry.hidden = false;
      status.textContent = 'Your painting is safe. Try preparing it again, or save your manuscript from the menu.';
    };
    const render = () => {
      const version = ++state.renderVersion;
      state.blob = null; state.file = null; syncActions();
      paintCard(canvas, { art: state.art, layout: state.artworkLayout, name, footerLeft: date, metrics: options.metrics || {}, includeMetrics: state.includeMetrics });
      canvas.setAttribute('aria-label', `Pulse Painting. ${name}, composed from ${duration} of accepted pulse${date ? ` on ${date}` : ''}. Metrics ${state.includeMetrics ? 'included' : 'excluded'} from artwork.`);
      state.ready = new Promise(resolve => {
        try { canvas.toBlob(blob => {
          if (state.disposed || version !== state.renderVersion) { resolve(null); return; }
          if (!blob) { failed(); resolve(null); return; }
          state.blob = blob;
          state.file = new File([blob], 'pulse-painting.png', { type: 'image/png' });
          syncActions(); status.textContent = ''; retry.hidden = true; resolve(blob);
        }, 'image/png'); } catch { failed(); resolve(null); }
      });
      return state.ready;
    };
    const download = () => {
      if (!state.blob || state.disposed) return;
      const url = URL.createObjectURL(state.blob); state.urls.add(url);
      const link = document.createElement('a'); link.href = url; link.download = 'pulse-painting.png'; link.rel = 'noopener';
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => { URL.revokeObjectURL(url); state.urls.delete(url); }, 60000);
      status.textContent = 'Artwork download started.';
    };
    const shareArtwork = () => {
      if (!state.file || state.sharing || state.disposed) return;
      if (window.PulseShare) {
        state.shareHub = window.PulseShare.open({
          blob: state.blob, title: 'Pulse Painting', fileName: 'pulse-painting.png',
          onPublish: typeof options.onPublish === 'function' ? options.onPublish : undefined,
        });
        return;
      }
      const data = { files: [state.file], title: 'Pulse Painting' };
      let supported = false;
      try { supported = typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare(data); } catch { /* Fall back to download. */ }
      if (!supported) { download(); return; }
      state.sharing = true; syncActions();
      // The file is already prepared, keeping native sharing inside the tap's
      // transient activation instead of awaiting encoding before navigator.share.
      try {
        Promise.resolve(navigator.share(data)).then(() => {
          if (!state.disposed) status.textContent = 'Artwork shared.';
        }).catch(error => {
          if (!state.disposed) status.textContent = error?.name === 'AbortError' ? '' : 'Sharing is unavailable. Choose Save artwork from the menu to keep your landscape.';
        }).finally(() => { state.sharing = false; if (!state.disposed) syncActions(); });
      } catch (error) {
        state.sharing = false; syncActions(); status.textContent = error?.name === 'AbortError' ? '' : 'Sharing is unavailable. Choose Save artwork from the menu to keep your landscape.';
      }
    };
    save?.addEventListener('click', download); share?.addEventListener('click', shareArtwork);
    state.releaseActions = () => { save?.removeEventListener('click', download); share?.removeEventListener('click', shareArtwork); syncActions(); };
    checkbox.addEventListener('change', () => {
      state.includeMetrics = checkbox.checked; status.textContent = 'Preparing your artwork…';
      try { render(); } catch { failed(); }
    });
    const prepareArtwork = async () => {
      if (state.disposed) return null;
      retry.hidden = true; status.textContent = 'Preparing your artwork…';
      try {
        if (!state.art) {
          const art = document.createElement('canvas'); art.width = 1080; art.height = 1080;
          window.PulseLandscape.render(scene, art);
          // Publish only a completed painting. Encoding retries reuse these
          // exact pixels; a failed landscape render can still be tried again.
          state.art = art;
          state.artworkLayout = artworkLayout(art, scene);
        }
        checkbox.disabled = false;
        await render();
        return state;
      } catch { failed(); return null; }
    };
    retry.addEventListener('click', prepareArtwork);
    try {
      await Promise.allSettled([document.fonts?.load('88px "Water Brush"'), document.fonts?.load('30px "DM Sans"'), document.fonts?.load('500 46px "DM Sans"')]);
      if (state.disposed) return null;
      return await prepareArtwork();
    } catch {
      failed();
      return null;
    }
  }
  function clear(container) {
    for (const [target, state] of instances) {
      if (container && container !== target) continue;
      state.disposed = true; state.renderVersion++; state.releaseActions?.(); state.shareHub?.close();
      state.urls.forEach(url => URL.revokeObjectURL(url)); state.urls.clear();
      target.replaceChildren(); instances.delete(target);
    }
  }
  function getState(container) {
    const state = container ? instances.get(container) : [...instances.values()].at(-1);
    if (!state) return null;
    return {
      width: state.canvas.width, height: state.canvas.height, ready: !!state.blob, revision: state.revision,
      includeMetrics: state.includeMetrics, family: state.scene.family,
      artworkBounds: { ...(state.artworkLayout?.bounds || ARTWORK) },
      artworkViewport: { ...ARTWORK },
      artworkSourceBounds: state.artworkLayout ? { ...state.artworkLayout.source } : null,
      artworkContentBounds: state.artworkLayout ? { ...state.artworkLayout.content } : null,
      artworkPlacement: state.artworkLayout ? { ...state.artworkLayout.placement } : null,
      metricBounds: { ...METRICS },
      seed: state.scene.seed, version: state.scene.version, strokeCount: state.scene.strokes.length,
      usableSeconds: state.scene.usableSeconds, durationSec: state.options.durationSec,
      bytes: state.blob?.size || 0,
    };
  }
  async function preparePublication({ includeMetrics = false } = {}, container) {
    const state = container ? instances.get(container) : [...instances.values()].at(-1);
    const current = () => !!state && !state.disposed && (container ? instances.get(container) === state : [...instances.values()].includes(state));
    if (!current() || !state.art) throw new Error('Your finished painting is not ready yet.');
    const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
    // Public export is a fresh raster from the original cached artwork. It does
    // not reuse the report preview, its private date or its metrics setting.
    let metrics = null;
    if (includeMetrics === true) {
      const source = state.options.metrics || {};
      const metric = value => Number.isFinite(value) && value >= 0 && value <= 9999 ? Math.round(value * 10) / 10 : null;
      metrics = { hr: metric(source.hr), rmssd: metric(source.rmssd), sdnn: metric(source.sdnn) };
    }
    paintCard(canvas, { art: state.art, layout: state.artworkLayout, name: sceneName(state.scene), metrics: metrics || {}, includeMetrics: includeMetrics === true });
    const encode = quality => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Image preparation took too long. Please try again.')), 30000);
      try { canvas.toBlob(blob => {
        clearTimeout(timeout);
        blob ? resolve(blob) : reject(new Error('The image could not be prepared. Please try again.'));
      }, 'image/jpeg', quality); }
      catch { clearTimeout(timeout); reject(new Error('The image could not be prepared. Please try again.')); }
    });
    let blob = await encode(.92);
    if (blob.size > 2 * 1024 * 1024) blob = await encode(.82);
    if (!current()) throw new Error('The report changed. Open your current painting to publish it.');
    if (blob.size > 2 * 1024 * 1024) throw new Error('This image is too large to publish. Save it to your device instead.');
    return { blob, metrics, width: WIDTH, height: HEIGHT, revision: state.revision };
  }
  window.PulsePortrait = Object.freeze({ mount, clear, getState, preparePublication, paintCard });
})();
