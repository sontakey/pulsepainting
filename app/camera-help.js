// Friendly camera guidance only. This module never requests camera access,
// changes browser settings, or resumes capture without the app's click callback.
(() => {
  'use strict';
  const HOME = 'https://www.pulsepainting.com/';
  const icons = {
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    camera: '<path d="M8 6 9.5 3h5L16 6h4v14H4V6z"/><circle cx="12" cy="12.5" r="3.5"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
  };
  const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[name]}</svg>`;
  const guides = {
    safari: {
      label: 'Safari · iPhone or iPad',
      steps: [
        ['Open the page controls', 'In Safari, tap the Page Menu beside the address, then Website Settings. On some versions, choose More to find the website settings.'],
        ['Allow Camera for this site', 'Find Camera and choose Allow. You only need to change it for Pulse Painting.'],
        ['Come back when you’re ready', 'Close the settings panel and return to Pulse Painting to try the camera again.'],
      ],
      phone: 'In your phone’s Settings, open Apps, then Safari, then Camera. Choose Ask so Safari can request access. On older versions, Safari may appear directly in Settings.',
      support: ['Apple’s Safari guide', 'https://support.apple.com/guide/iphone/iphb01fc3c85/ios'],
    },
    'chrome-android': {
      label: 'Chrome · Android',
      steps: [
        ['Open Chrome’s settings', 'Tap the Chrome menu, then Settings, Site settings, and Camera.'],
        ['Allow this site', 'Let sites ask to use the camera. If Pulse Painting is under Blocked, select it and choose Allow.'],
        ['Return to your painting', 'Come back to Pulse Painting and try the camera again. Choose Allow if Chrome asks.'],
      ],
      phone: 'In your phone’s Settings, open Apps, Chrome, Permissions, then Camera. Allow access while using the app. If your phone has a Camera access switch in Quick Settings, make sure it is on.',
      support: ['Google’s camera-permission guide', 'https://support.google.com/chrome/answer/2693767?hl=en&co=GENIE.Platform%3DAndroid'],
    },
    'chrome-ios': {
      label: 'Chrome · iPhone or iPad',
      steps: [
        ['Find the camera control', 'If a camera icon appears to the left of the address, tap it. It appears after a site’s camera permission changes.'],
        ['Turn permission on', 'Use the camera control to turn this site’s permission on. If there is no icon, check the phone settings below.'],
        ['Try again when you’re ready', 'Return to Pulse Painting and try the camera again. Choose Allow if Chrome asks.'],
      ],
      phone: 'In your phone’s Settings, open Privacy & Security, then Camera, and turn Chrome on if it is listed. If Chrome is not listed, return here and try the camera once to request access.',
      support: ['Google’s iPhone camera guide', 'https://support.google.com/chrome/answer/2693767?co=GENIE.Platform%3DiOS&hl=en'],
    },
    firefox: {
      label: 'Firefox · Android',
      steps: [
        ['Open site settings', 'In Firefox, open the menu, then Settings and Site settings. Older versions may call this Site permissions.'],
        ['Let Camera ask', 'Choose Camera, then Ask to allow. If this site has a saved block, find it under Exceptions and clear its Camera permission.'],
        ['Return and allow access', 'Come back to Pulse Painting and try the camera again. Choose Allow when Firefox asks.'],
      ],
      phone: 'If Firefox says Blocked by Android, open your phone’s Settings, then Apps, Firefox, Permissions, and Camera. Allow access while using the app. Check the phone’s Camera access switch too, if present.',
      support: ['Mozilla’s camera-permission guide', 'https://support.mozilla.org/en-US/kb/how-manage-your-camera-and-microphone-permissions'],
    },
    samsung: {
      label: 'Samsung Internet',
      steps: [
        ['Open this site’s controls', 'Tap the lock or site-information control beside the address.'],
        ['Look for Camera', 'Allow Camera if it is listed. Otherwise, look in Menu, Settings, Sites and downloads, then Site permissions. Labels can vary by version.'],
        ['Come back and try again', 'Return to Pulse Painting and try the camera again. Choose Allow if the browser asks.'],
      ],
      phone: 'In your phone’s Settings, open Apps, Samsung Internet, Permissions, then Camera. Allow access while using the app. Check that Camera access is on in Quick Settings, if your phone shows that switch.',
      support: ['Android’s app-permission guide', 'https://support.google.com/android/answer/9431959?hl=en'],
    },
    other: {
      label: 'Another browser',
      steps: [
        ['Open the site controls', 'Look beside the address for a menu, lock, or site-information control.'],
        ['Check Camera permission', 'Find this site’s permissions and allow Camera. The setting’s name and location depend on your browser.'],
        ['Return to Pulse Painting', 'Come back here to try the camera again. If camera access is unavailable, open the site in Safari or Chrome on your phone.'],
      ],
      phone: 'Check your phone’s app permissions for this browser and allow Camera. Device restrictions or a work or school policy may also control access. If a setting is unavailable, the person managing the device can help.',
      support: null,
    },
  };
  const content = {
    guide: ['A little help with your camera', 'Your camera finds the light in your fingertip. No microphone needed.'],
    permission_denied: ['Let’s let the camera in', 'Camera access isn’t available yet. A small change in your browser or phone settings may help.'],
    camera_busy: ['Give your camera a moment', 'The camera couldn’t open. Another app may be using it, or your phone may need a moment.'],
    no_camera: ['Let’s find a camera', 'This browser hasn’t made a compatible camera available. Pulse Painting uses a phone’s rear camera and flash.'],
    overconstrained: ['Let’s try your camera again', 'The camera couldn’t use the requested settings. A fresh attempt or another phone browser may help.'],
    unsupported: ['Open a little space to paint', 'This browser can’t provide camera access here. Try opening Pulse Painting directly in Safari or Chrome on your phone.'],
    insecure_context: ['Open Pulse Painting securely', 'Camera access needs a secure page. Open the link below to continue on the official site.'],
    aborted: ['Your camera needs another moment', 'The camera stopped before it was ready. Come back to this page and try again when you’re ready.'],
    unknown: ['Let’s try that again', 'The camera couldn’t get ready. We can check a few simple things together.'],
    waiting: ['One small permission first', 'If your browser is asking to use the camera, choose Allow. There’s no rush.'],
  };
  const recovery = {
    camera_busy: [
      ['Close anything using the camera', 'Finish a video call or close another camera app, then return to this page.'],
      ['Try again when you’re ready', 'If the camera still won’t open, reopen your browser. You can check permissions below too.'],
    ],
    no_camera: [
      ['Use your phone’s browser', 'Open Pulse Painting on a phone with a rear camera and flash.'],
      ['Check access, then retry', 'The browser may need permission before it can find your camera. The settings guide below can help.'],
    ],
    overconstrained: [
      ['Return to this page', 'Keep Pulse Painting in the foreground and try the camera once more.'],
      ['Try another browser if needed', 'Open the link in Safari or Chrome on your phone. A device without a compatible camera may not support capture.'],
    ],
    aborted: [
      ['Come back to the page', 'Keep your browser open in the foreground while the camera starts.'],
      ['Try a fresh start', 'If it happens again, close other camera apps and check permissions below.'],
    ],
    unknown: [
      ['Return and try again', 'Keep the browser in the foreground and close other apps using the camera.'],
      ['Check your camera access', 'Your browser and your phone may each have a camera setting. Use the guide below.'],
    ],
  };
  let active = null;
  let selectedBrowser = null;
  const ios = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
  function browserHint() {
    const ua = navigator.userAgent;
    if (ios()) return /CriOS/i.test(ua) ? 'chrome-ios' : /FxiOS|EdgiOS|OPiOS/i.test(ua) ? 'other' : 'safari';
    if (/SamsungBrowser/i.test(ua)) return 'samsung';
    if (/Android/i.test(ua)) return /Firefox/i.test(ua) ? 'firefox' : /Chrome/i.test(ua) ? 'chrome-android' : 'other';
    return 'other';
  }
  const embeddedHint = () => /FBAN|FBAV|Instagram|Line\/|TikTok|Bytedance|; wv\)/i.test(navigator.userAgent);

  function illustration() {
    return `<figure class="ch-illustration" aria-label="Illustration: open browser controls, find Camera, and allow access.">
      <svg viewBox="0 0 360 98" role="img" aria-hidden="true" focusable="false">
        <defs><linearGradient id="ch-wash" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#dce8fc"/><stop offset=".55" stop-color="#e2ebe9"/><stop offset="1" stop-color="#f2e8dc"/></linearGradient></defs>
        <path d="M11 17 28 13 45 15 62 11 89 14 118 9 145 13 171 10 200 14 224 10 252 13 281 10 305 15 338 11 349 19 345 38 351 54 345 75 349 82 324 86 299 83 274 89 251 84 224 88 199 85 170 90 147 85 117 89 88 85 64 88 37 83 13 86 7 73 11 57 6 40Z" fill="url(#ch-wash)" opacity=".7"/>
        <g fill="#fdfbf7" stroke="#bccdd4" stroke-width="1.2"><rect x="28" y="24" width="78" height="48" rx="8"/><rect x="141" y="24" width="78" height="48" rx="8"/><rect x="254" y="24" width="78" height="48" rx="8"/></g>
        <g fill="none" stroke="#315c78" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M43 39h47M43 47h47M43 55h47"/><circle cx="56" cy="39" r="3" fill="#fdfbf7"/><circle cx="79" cy="47" r="3" fill="#fdfbf7"/><circle cx="63" cy="55" r="3" fill="#fdfbf7"/><path d="m174 35 2-4h8l2 4h8v25h-28V35Z"/><circle cx="180" cy="47" r="6"/><path d="m282 48 8 8 15-17"/><path d="M115 48h16m-5-5 5 5-5 5M228 48h16m-5-5 5 5-5 5"/></g>
      </svg>
      <figcaption><span>Site controls</span><span>Camera</span><span>Allow</span></figcaption><p>Your browser may look a little different.</p>
    </figure>`;
  }
  function listSteps(container, steps) {
    container.replaceChildren();
    steps.forEach(([title, text], i) => {
      const li = document.createElement('li'), number = document.createElement('span'), copy = document.createElement('div'), strong = document.createElement('strong'), p = document.createElement('p');
      number.className = 'ch-step-number'; number.textContent = String(i + 1); number.setAttribute('aria-hidden', 'true');
      strong.textContent = title; p.textContent = text; copy.append(strong, p); li.append(number, copy); container.append(li);
    });
  }
  function close() {
    const state = active;
    if (!state) return;
    active = null;
    state.closed = true;
    state.controller.abort();
    if (state.dialog.open) state.dialog.close();
    state.dialog.remove();
    document.documentElement.style.overflow = state.previousOverflow;
    const target = state.returnFocus;
    if (target?.isConnected && !target.disabled && target.getClientRects().length && !target.closest('[hidden]')) target.focus({ preventScroll: true });
  }
  function open(options = {}) {
    close();
    const reason = Object.hasOwn(content, options.reason) ? options.reason : 'guide';
    const [title, intro] = content[reason];
    const dialog = document.createElement('dialog');
    dialog.className = 'pulse-camera-help';
    dialog.dataset.reason = reason;
    dialog.setAttribute('aria-labelledby', 'camera-help-title');
    dialog.setAttribute('aria-describedby', 'camera-help-intro');
    dialog.innerHTML = `<div class="ch-shell">
      <button type="button" class="ch-close" aria-label="Close camera help">${svg('close')}</button>
      <div class="ch-scroll">
        <header class="ch-header"><p class="ch-eyebrow">A little guidance</p><h2 id="camera-help-title" tabindex="-1"></h2><p id="camera-help-intro"></p></header>
        ${illustration()}
        <div class="ch-content">
          <ol class="ch-steps ch-recovery" hidden></ol>
          <p class="ch-waiting-note" hidden>Close this help and look for the browser’s permission prompt. You can skip an optional motion request. If no prompt is visible, cancel this reading, then reload the page to start fresh.</p>
          <details class="ch-settings"><summary>Camera settings ${svg('plus')}</summary><div class="ch-settings-body">
            <label class="ch-browser-label" for="camera-help-browser">Your browser<span>Choose another if this doesn’t match.</span></label>
            <select id="camera-help-browser" class="ch-browser"></select>
            <ol class="ch-steps ch-browser-steps"></ol>
            <details class="ch-phone"><summary>Still no camera access? ${svg('plus')}</summary><p class="ch-phone-copy"></p><p class="ch-managed">If the setting is locked or missing, a device restriction or work or school policy may control it. The person managing the device can help.</p><a class="ch-support" target="_blank" rel="noopener noreferrer">Official browser guide ${svg('arrow')}</a></details>
          </div></details>
          <details class="ch-open-browser"><summary>Opened inside another app? ${svg('plus')}</summary><p>Use that app’s menu to open this page in your phone’s browser, if available. Or copy the link and paste it into Safari or Chrome.</p><div class="ch-link-row"><input class="ch-link" type="text" readonly aria-label="Pulse Painting link" value="${HOME}"><button type="button" class="ch-copy" aria-label="Copy Pulse Painting link">${svg('copy')}</button></div><p class="ch-copy-status" role="status" aria-live="polite" aria-atomic="true"></p></details>
          <p class="ch-privacy">The camera preview is processed on your phone. No microphone needed.</p>
        </div>
      </div>
      <footer class="ch-footer"><p class="ch-recording-note" hidden>Your current painting is still here. Starting a new reading replaces it.</p><div class="ch-actions"><button type="button" class="ch-keep" hidden>Keep this painting</button><button type="button" class="ch-retry">Try camera again ${svg('arrow')}</button><a class="ch-open-link" href="${HOME}" hidden>Open Pulse Painting ${svg('arrow')}</a><button type="button" class="ch-done" hidden>Close help</button></div><p class="ch-footer-note">Take your time. Your painting can wait.</p></footer>
    </div>`;
    const state = { dialog, controller: new AbortController(), returnFocus: document.activeElement, previousOverflow: document.documentElement.style.overflow, closed: false };
    active = state;
    const signal = state.controller.signal;
    const dismiss = () => { if (active !== state) return; close(); options.onClose?.(); };
    const action = callback => { if (active !== state) return; close(); callback?.(); };
    dialog.querySelector('#camera-help-title').textContent = title;
    dialog.querySelector('#camera-help-intro').textContent = intro;
    const settings = dialog.querySelector('.ch-settings');
    settings.open = reason === 'guide' || reason === 'permission_denied';
    if (settings.open) settings.classList.add('ch-settings-primary');
    const list = dialog.querySelector('.ch-recovery');
    if (recovery[reason]) { list.hidden = false; listSteps(list, recovery[reason]); }
    const isWaiting = reason === 'waiting';
    dialog.querySelector('.ch-waiting-note').hidden = !isWaiting;
    const external = reason === 'unsupported' || reason === 'insecure_context';
    dialog.querySelector('.ch-illustration').hidden = external;
    const inApp = dialog.querySelector('.ch-open-browser');
    inApp.open = external || embeddedHint();
    if (external) inApp.querySelector('summary').firstChild.textContent = 'Open in your phone’s browser ';
    const select = dialog.querySelector('.ch-browser');
    Object.entries(guides).forEach(([value, guide]) => { const option = document.createElement('option'); option.value = value; option.textContent = guide.label; select.append(option); });
    select.value = selectedBrowser || browserHint();
    function renderGuide() {
      const guide = guides[select.value] || guides.other;
      listSteps(dialog.querySelector('.ch-browser-steps'), guide.steps);
      dialog.querySelector('.ch-phone-copy').textContent = guide.phone;
      const support = dialog.querySelector('.ch-support');
      support.hidden = !guide.support;
      if (guide.support) { support.firstChild.textContent = `${guide.support[0]} `; support.href = guide.support[1]; }
      else support.removeAttribute('href');
    }
    renderGuide();
    select.addEventListener('change', () => { selectedBrowser = select.value; renderGuide(); }, { signal });
    const retry = dialog.querySelector('.ch-retry'), keep = dialog.querySelector('.ch-keep'), done = dialog.querySelector('.ch-done');
    const canKeep = options.hasRecording === true && typeof options.onKeep === 'function';
    const canRetry = options.canRetry !== false && typeof options.onRetry === 'function' && !isWaiting && !external;
    retry.hidden = !canRetry;
    keep.hidden = !canKeep;
    done.hidden = canRetry || external;
    dialog.querySelector('.ch-open-link').hidden = !external;
    const recordingNote = dialog.querySelector('.ch-recording-note');
    recordingNote.hidden = !canKeep || (!canRetry && !external);
    if (canKeep && external) recordingNote.textContent = 'Your current painting is still here. Keep it before opening another page.';
    if (canKeep) retry.firstChild.textContent = 'Start a new reading ';
    retry.addEventListener('click', () => action(options.onRetry), { signal });
    keep.addEventListener('click', () => action(options.onKeep), { signal });
    done.addEventListener('click', dismiss, { signal });
    dialog.querySelector('.ch-close').addEventListener('click', dismiss, { signal });
    dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); }, { signal });
    let pointerOutside = false;
    const outside = event => { const rect = dialog.getBoundingClientRect(); return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom; };
    dialog.addEventListener('pointerdown', event => { pointerOutside = event.target === dialog && outside(event); }, { signal });
    dialog.addEventListener('click', event => { if (pointerOutside && event.target === dialog && outside(event)) dismiss(); pointerOutside = false; }, { signal });
    window.addEventListener('popstate', dismiss, { signal });
    dialog.querySelector('.ch-copy').addEventListener('click', async () => {
      const status = dialog.querySelector('.ch-copy-status'), input = dialog.querySelector('.ch-link');
      try {
        if (typeof navigator.clipboard?.writeText !== 'function') throw new Error('unavailable');
        await navigator.clipboard.writeText(HOME);
        if (!state.closed) status.textContent = 'Link copied. Paste it into your phone’s browser.';
      } catch {
        if (state.closed) return;
        input.focus(); input.select(); input.setSelectionRange(0, HOME.length);
        status.textContent = 'Copy isn’t available here. Touch and hold the selected link to copy it.';
      }
    }, { signal });
    document.body.append(dialog);
    document.documentElement.style.overflow = 'hidden';
    dialog.showModal();
    dialog.querySelector('#camera-help-title').focus({ preventScroll: true });
    return dialog;
  }
  window.PulseCameraHelp = { open, close, isOpen: () => !!active };
})();
