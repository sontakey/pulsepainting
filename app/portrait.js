// The shared image is a higher-resolution raster of the same persistent scene
// used during capture. Source data and the scene descriptor remain in memory;
// only pixels, and explicitly opted-in summary metrics, enter the public file.
(() => {
  'use strict';
  const WIDTH = 1080, HEIGHT = 1350;
  const PAPER = '#fdfbf7', INK = '#15213a', BLUE = '#445775';
  const instances = new Map();
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
      <label class="portrait-options"><input type="checkbox" disabled><span>Include pulse and HRV metrics in artwork</span></label>
      <p class="portrait-status" role="status" aria-live="polite">Preparing your artwork…</p>
      <button type="button" class="portrait-retry" hidden>Try artwork again</button>`;
    container.append(section);
    const canvas = section.querySelector('canvas'), checkbox = section.querySelector('input');
    const share = options.shareButton, save = options.saveButton, status = section.querySelector('.portrait-status'), retry = section.querySelector('.portrait-retry');
    const name = sceneName(scene), duration = durationLabel(scene.usableSeconds), date = dateLabel(options.startedAt);
    section.querySelector('figcaption').textContent = `Made from ${duration} of accepted pulse. Your original waveform is in the menu.`;
    const state = { canvas, section, scene, options, includeMetrics: false, blob: null, file: null, sharing: false, renderVersion: 0, disposed: false, urls: new Set() };
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
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = PAPER; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      // Uniform scaling preserves the full scene and its original framing. The
      // optional metrics never crop, reposition or recolor the recorded strokes.
      ctx.drawImage(state.art, 40, 146, 1000, 1000);
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = INK;
      ctx.font = '400 104px "Water Brush", cursive';
      ctx.fillText('Pulse Painting', WIDTH / 2, 92, WIDTH - 112);
      ctx.fillStyle = BLUE;
      if (state.includeMetrics) {
        const metrics = options.metrics || {};
        [['Pulse', metrics.hr, 'bpm'], ['RMSSD', metrics.rmssd, 'ms'], ['SDNN', metrics.sdnn, 'ms']].forEach(([label, value, unit], index) => {
          const x = 210 + index * 330;
          ctx.font = '400 30px "DM Sans", sans-serif'; ctx.fillText(label, x, 1179);
          ctx.font = '600 38px "DM Sans", sans-serif'; ctx.fillText(`${valueLabel(value)} ${unit}`, x, 1226);
        });
      } else {
        ctx.font = '500 46px "DM Sans", sans-serif'; ctx.fillText(name, WIDTH / 2, 1202, WIDTH - 100);
      }
      ctx.font = '400 30px "DM Sans", sans-serif';
      ctx.fillText(`${date ? `${date}  ·  ` : ''}${duration} of pulse`, WIDTH / 2, 1262);
      ctx.font = '500 34px "DM Sans", sans-serif'; ctx.fillText('pulsepainting.com · by ChatPPG', WIDTH / 2, 1315, WIDTH - 96);
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
        }
        checkbox.disabled = false;
        await render();
        return state;
      } catch { failed(); return null; }
    };
    retry.addEventListener('click', prepareArtwork);
    try {
      await Promise.allSettled([document.fonts?.load('104px "Water Brush"'), document.fonts?.load('46px "DM Sans"'), document.fonts?.load('600 38px "DM Sans"')]);
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
      state.disposed = true; state.renderVersion++; state.releaseActions?.();
      state.urls.forEach(url => URL.revokeObjectURL(url)); state.urls.clear();
      target.replaceChildren(); instances.delete(target);
    }
  }
  function getState(container) {
    const state = container ? instances.get(container) : [...instances.values()].at(-1);
    if (!state) return null;
    return {
      width: state.canvas.width, height: state.canvas.height, ready: !!state.blob,
      includeMetrics: state.includeMetrics, family: state.scene.family,
      seed: state.scene.seed, version: state.scene.version, strokeCount: state.scene.strokes.length,
      usableSeconds: state.scene.usableSeconds, durationSec: state.options.durationSec,
      bytes: state.blob?.size || 0,
    };
  }
  window.PulsePortrait = Object.freeze({ mount, clear, getState });
})();
