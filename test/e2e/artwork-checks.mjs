// Browser checks for the real report's artwork. Native sharing is mocked here:
// these checks cover payloads and recovery, not a physical iPhone share sheet.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function assertArtworkPngPrivacy(png) {
  for (let offset=8;offset<png.length;) {
    const length=png.readUInt32BE(offset),type=png.toString('ascii',offset+4,offset+8),data=png.subarray(offset+8,offset+8+length);
    assert.ok(!['tEXt','zTXt','iTXt'].includes(type),'shared PNG contains no textual source/session metadata');
    if(type==='eXIf') {
      // WebKit's native canvas encoder emits EXIF color space and pixel
      // dimensions. Permit only those scalar image facts, never GPS, dates,
      // identifiers, comments, arbitrary payloads or private source descriptors.
      assert.ok(data.length<=256&&['II','MM'].includes(data.toString('ascii',0,2)),'bounded standard canvas EXIF');
      const little=data.toString('ascii',0,2)==='II';
      const u16=o=>little?data.readUInt16LE(o):data.readUInt16BE(o),u32=o=>little?data.readUInt32LE(o):data.readUInt32BE(o);
      assert.equal(u16(2),42,'standard TIFF metadata marker');
      const covered=new Uint8Array(data.length);covered.fill(1,0,8);const visited=new Set();
      const visit=at=>{
        assert.ok(!visited.has(at)&&at>=8&&at+6<=data.length,'bounded noncyclic EXIF directory');visited.add(at);
        const count=u16(at),end=at+2+count*12+4;assert.ok(count<=4&&end<=data.length,'bounded EXIF entries');covered.fill(1,at,end);
        for(let i=0;i<count;i++){
          const p=at+2+i*12,tag=u16(p),kind=u16(p+2);assert.equal(u32(p+4),1,'canvas EXIF uses scalar image facts');
          if(tag===0x8769){assert.equal(kind,4);visit(u32(p+8));continue;}
          assert.ok([0xa001,0xa002,0xa003].includes(tag),'EXIF excludes private or identifying tags');
          assert.ok(kind===3||kind===4,'EXIF excludes strings and opaque data');
          const value=kind===3?u16(p+8):u32(p+8);
          assert.equal(value,tag===0xa001?1:tag===0xa002?png.readUInt32BE(16):png.readUInt32BE(20),'EXIF only describes this rendered image');
        }
        assert.equal(u32(end-4),0,'no additional EXIF directories');
      };
      visit(u32(4));assert.ok(covered.every(Boolean),'EXIF has no unused payload for private metadata');
    }
    offset+=12+length;
  }
}

export async function openReportMenu(page) {
  if (!await page.locator('#debug-sheet').isVisible()) await page.locator('#btn-debug-menu').click();
  await page.locator('#debug-sheet').waitFor({ state: 'visible' });
}

export async function closeReportMenu(page) {
  if (await page.locator('#debug-sheet').isVisible()) await page.locator('#btn-debug-close').click();
}

async function checkReportActions(page) {
  const actions = page.locator('#screen-summary .summary-actions');
  assert.deepEqual(await actions.locator('button').allTextContents(), ['Share artwork', 'Measure again'], 'report dock contains only Share artwork and Measure again');
  assert.equal(await page.getByRole('button', { name: 'Share artwork', exact: true, includeHidden: true }).count(), 1, 'report contains one Share artwork action');
  assert.equal(await page.locator('.portrait-actions').count(), 0, 'artwork has no duplicate inline action row');
  assert.equal(await actions.locator('#btn-share-artwork.btn-primary').count(), 1, 'Share artwork is the primary report action');
  assert.equal(await actions.getByRole('button', { name: 'Save report', exact: true }).count(), 0, 'Save report is absent from the floating dock');
}

export async function checkEmptyArtworkActions(page) {
  await checkReportActions(page);
  assert.equal(await page.locator('#btn-share-artwork').isDisabled(), true, 'an empty report cannot share nonexistent artwork');
  await openReportMenu(page);
  try {
    assert.equal(await page.locator('#debug-sheet #btn-save-artwork').isDisabled(), true, 'an empty report cannot save nonexistent artwork');
  } finally { await closeReportMenu(page); }
}

export async function checkReportDockViewport(page) {
  const result = await page.evaluate(async () => {
    const originalViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    const originalFocus = document.activeElement;
    const originalScroll = { x: scrollX, y: scrollY };
    const editable = document.createElement('input');
    editable.type = 'text';
    editable.setAttribute('aria-label', 'Keyboard layout regression probe');
    editable.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
    const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const snapshot = () => ({
      reserve: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mobile-dock-reserve')),
      inset: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mobile-viewport-inset')),
      dockBottom: parseFloat(getComputedStyle(document.querySelector('.summary-actions')).bottom),
    });
    const keyboardGap = 350;
    try {
      document.activeElement?.blur();
      window.dispatchEvent(new Event('resize'));
      await settle();
      const baseline = snapshot();
      Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        value: { height: innerHeight - keyboardGap, offsetTop: 0, scale: 1 },
      });
      window.dispatchEvent(new Event('resize'));
      await settle();
      const unfocused = snapshot();
      document.querySelector('.portrait-options input').focus({ preventScroll: true });
      await settle();
      const checkbox = snapshot();
      document.body.append(editable);
      editable.focus({ preventScroll: true });
      await settle();
      const editing = snapshot();
      editable.blur();
      await settle();
      const blurred = snapshot();
      return { baseline, unfocused, checkbox, editing, blurred, keyboardGap };
    } finally {
      editable.remove();
      if (originalViewport) Object.defineProperty(window, 'visualViewport', originalViewport);
      else delete window.visualViewport;
      if (originalFocus instanceof HTMLElement) originalFocus.focus({ preventScroll: true });
      window.dispatchEvent(new Event('resize'));
      await settle();
      window.scrollTo(originalScroll.x, originalScroll.y);
    }
  });
  assert.equal(result.baseline.inset, 0, 'report starts without keyboard compensation');
  assert.deepEqual(result.unfocused, result.baseline, 'browser viewport shrink without text focus adds no report whitespace');
  assert.deepEqual(result.checkbox, result.baseline, 'metrics checkbox cannot activate keyboard compensation');
  assert.equal(result.editing.inset, result.keyboardGap, 'a focused text field keeps the dock above its keyboard');
  assert.equal(result.editing.reserve, result.baseline.reserve + result.keyboardGap, 'genuine keyboard focus retains room to scroll the final editable content above the dock');
  assert.deepEqual(result.blurred, result.baseline, 'focusout clears keyboard compensation even before the visual viewport recovers');
  return result;
}

export async function checkArtwork(page, output = process.env.PPG_ARTWORK_ARTIFACTS) {
  await page.waitForFunction(() => window.PulsePortrait?.getState()?.ready);
  await checkReportActions(page);
  assert.equal(await page.locator('#btn-share-artwork').isEnabled(), true, 'floating Share artwork becomes available when its PNG is ready');
  const preparation = await page.evaluate(async () => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-10000px;width:500px';
    document.body.append(host);
    const fonts = document.fonts;
    const originalLoad = Object.getOwnPropertyDescriptor(fonts, 'load');
    const shareButton = document.createElement('button');
    const saveButton = document.createElement('button');
    let releaseFonts;
    const fontGate = new Promise(resolve => { releaseFonts = resolve; });
    try {
      Object.defineProperty(fonts, 'load', { configurable: true, value: () => fontGate });
      const mounting = PulsePortrait.mount(host, {
        landscape,
        segments: manuscript.segments,
        start: manuscript.segments[0].points[0].t,
        durationSec: elapsedMeasuringMs / 1000,
        startedAt: new Date(portraitStartedAt || Date.now()),
        pigmentAt,
        shareButton, saveButton,
        paintRows: (canvas, rowIndices) => paintManuscriptRaster(canvas, false, true, null, true, { rowIndices }),
      });
      const checkbox = host.querySelector('.portrait-options input');
      const disabledWhilePreparing = checkbox.disabled && shareButton.disabled && saveButton.disabled;
      releaseFonts([]);
      const state = await mounting;
      const enabledWhenReady = !checkbox.disabled && !shareButton.disabled && !saveButton.disabled && PulsePortrait.getState(host).ready;
      checkbox.click();
      const disabledWhileRegenerating = shareButton.disabled && saveButton.disabled;
      await state.ready;
      const enabledAfterRegenerating = !shareButton.disabled && !saveButton.disabled && PulsePortrait.getState(host).ready;
      PulsePortrait.clear(host);
      const disabledAfterClear = shareButton.disabled && saveButton.disabled;
      return { disabledWhilePreparing, enabledWhenReady, disabledWhileRegenerating, enabledAfterRegenerating, disabledAfterClear };
    } finally {
      releaseFonts([]);
      if (originalLoad) Object.defineProperty(fonts, 'load', originalLoad); else delete fonts.load;
      PulsePortrait.clear(host);
      host.remove();
    }
  });
  assert.equal(preparation.disabledWhilePreparing, true, 'metrics toggle and external artwork actions are unavailable until artwork resources exist');
  assert.equal(preparation.enabledWhenReady, true, 'metrics toggle and external artwork actions become available after preparation');
  assert.equal(preparation.disabledWhileRegenerating, true, 'external artwork actions wait for regenerated PNG pixels');
  assert.equal(preparation.enabledAfterRegenerating, true, 'external artwork actions become available after regeneration');
  assert.equal(preparation.disabledAfterClear, true, 'clearing a portrait disables its external artwork controls');
  const recovery = await page.evaluate(async () => {
    const outcomes=[];
    for (const mode of ['encoder', 'renderer']) {
      const host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;width:500px';document.body.append(host);
      const share=document.createElement('button'),save=document.createElement('button');
      const originalToBlob=HTMLCanvasElement.prototype.toBlob, originalLandscape=window.PulseLandscape;
      const sourceBefore=JSON.stringify(landscape);
      try {
        if(mode==='encoder')HTMLCanvasElement.prototype.toBlob=function(callback){callback(null);};
        else window.PulseLandscape={...originalLandscape,render(){throw new Error('Test-only renderer failure');}};
        await PulsePortrait.mount(host,{landscape,durationSec:elapsedMeasuringMs/1000,startedAt:new Date(portraitStartedAt),shareButton:share,saveButton:save});
        const retry=host.querySelector('.portrait-retry');
        const held=retry&&!retry.hidden&&share.disabled&&save.disabled&&!PulsePortrait.getState(host).ready;
        HTMLCanvasElement.prototype.toBlob=originalToBlob;window.PulseLandscape=originalLandscape;
        const retryStarted=performance.now();retry.click();
        const until=performance.now()+5000;
        while(!PulsePortrait.getState(host).ready&&performance.now()<until)await new Promise(resolve=>setTimeout(resolve,20));
        outcomes.push({mode,held,ready:PulsePortrait.getState(host).ready,sourceStable:sourceBefore===JSON.stringify(landscape),sameSeed:PulsePortrait.getState(host).seed===landscape.seed,family:landscape.family,retryMs:performance.now()-retryStarted,status:host.querySelector('.portrait-status')?.textContent,retryVisible:!retry.hidden});
      } finally {HTMLCanvasElement.prototype.toBlob=originalToBlob;window.PulseLandscape=originalLandscape;PulsePortrait.clear(host);host.remove();}
    }
    return outcomes;
  });
  console.log('ARTWORK_RECOVERY',JSON.stringify(recovery));
  for(const result of recovery){
    assert.equal(result.held,true, `${result.mode}: unavailable export offers retry and disables sharing`);
    assert.equal(result.ready,true, `${result.mode}: retry prepares the original artwork`);
    assert.ok(result.sourceStable&&result.sameSeed, `${result.mode}: failure and recovery preserve every source stroke and scene seed`);
  }
  const canvas = page.locator('.portrait-preview canvas');
  const checkbox = page.locator('.portrait-options input');
  const originalViewport = page.viewportSize();
  const captured = await page.evaluate(() => {
    const state = PulsePortrait.getState(portraitHost);
    const sceneBefore = JSON.stringify(landscape);
    const exact = document.createElement('canvas'); exact.width = exact.height = 1080;
    PulseLandscape.render(landscape, exact);
    const portraitCanvas=document.querySelector('.portrait-preview canvas');
    // Use the portrait's exact destination coordinates for both render paths.
    // Comparing a copied crop against an origin-aligned resample adds a second
    // backend-dependent rounding step that is unrelated to scene preservation.
    const expectedArt = document.createElement('canvas'); expectedArt.width=1080;expectedArt.height=1350;
    expectedArt.getContext('2d').drawImage(exact,40,146,1000,1000);
    const a=portraitCanvas.getContext('2d').getImageData(40,146,1000,1000).data,b=expectedArt.getContext('2d').getImageData(40,146,1000,1000).data;
    const portraitArt=document.createElement('canvas');portraitArt.width=portraitArt.height=1000;
    portraitArt.getContext('2d').drawImage(portraitCanvas,40,146,1000,1000,0,0,1000,1000);
    let maxArtDelta=0, artDelta=0, deltaBounds={minY:1000,maxY:0,minX:1000,maxX:0};for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);maxArtDelta=Math.max(maxArtDelta,d);artDelta+=d;if(d>2){const pixel=Math.floor(i/4),x=pixel%1000,y=Math.floor(pixel/1000);deltaBounds.minX=Math.min(deltaBounds.minX,x);deltaBounds.maxX=Math.max(deltaBounds.maxX,x);deltaBounds.minY=Math.min(deltaBounds.minY,y);deltaBounds.maxY=Math.max(deltaBounds.maxY,y);}}

    return {
      state, expectedDuration: elapsedMeasuringMs / 1000,
      scene: { family: landscape.family, seed: landscape.seed, version: landscape.version, strokeCount: landscape.strokes.length, usableSeconds: landscape.usableSeconds },
      sourceUnchanged: sceneBefore === JSON.stringify(landscape),
      art: portraitArt.toDataURL(), maxArtDelta, meanArtDelta:artDelta/a.length, deltaBounds,
      image: document.querySelector('.portrait-preview canvas').toDataURL(),
      accessibleDescription: document.querySelector('.portrait-preview canvas').getAttribute('aria-label'),
    };
  });
  assert.equal(captured.state.width, 1080, 'share artwork width');
  assert.equal(captured.state.height, 1350, 'share artwork height');
  assert.equal(captured.state.durationSec, captured.expectedDuration, 'portrait uses actual active capture duration, including early finishes');
  assert.equal(captured.state.includeMetrics, false, 'numeric metrics are excluded from shared artwork by default');
  assert.equal(await checkbox.isChecked(), false, 'metrics inclusion starts unchecked');
  assert.match(captured.accessibleDescription, /landscape|pulse/i, 'artwork has an accessible description');
  for (const key of ['family', 'seed', 'version', 'strokeCount', 'usableSeconds'])
    assert.equal(captured.state[key], captured.scene[key], `portrait retains capture scene ${key}`);
  assert.ok(captured.state.strokeCount > 0 && captured.state.usableSeconds > 0, 'personal landscape contains accepted data');
  assert.equal(captured.sourceUnchanged, true, 'export never mutates the private source descriptor');
  console.log('PORTRAIT_SCENE_PARITY',JSON.stringify({max:captured.maxArtDelta,mean:captured.meanArtDelta,bounds:captured.deltaBounds}));
  assert.ok(captured.maxArtDelta<=1&&captured.meanArtDelta<.01, 'portrait contains the full capture landscape within one-level Canvas2D copy rounding, without re-layout or selected rows');

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const layout = await page.locator('.pulse-portrait').evaluate(section => {
      const canvasWidth = section.querySelector('canvas').getBoundingClientRect().width;
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        canvasWidth,
        labels: [...section.querySelectorAll('p,figcaption,label,button')].map(element => ({ font: parseFloat(getComputedStyle(element).fontSize), height: element.getBoundingClientRect().height })),
        actionHeights: [...document.querySelectorAll('#screen-summary .summary-actions button')].map(button => button.getBoundingClientRect().height),
      };
    });
    assert.equal(layout.overflow, false, `portrait fits ${width}px viewport`);
    assert.ok(layout.canvasWidth > 0, `full artwork remains visible at ${width}px viewport`);
    assert.ok(layout.labels.every(label => label.font >= 14), `portrait supporting labels remain at least 14px at ${width}px viewport`);
    assert.ok(layout.actionHeights.length === 2 && layout.actionHeights.every(height => height >= 44), 'floating report actions retain touch target height');
  }
  await checkReportDockViewport(page);
  await page.setViewportSize(originalViewport);

  await openReportMenu(page);
  assert.equal(await page.locator('#debug-sheet').getByRole('button', { name: 'Save report', exact: true }).count(), 1, 'scientific report export is available in the menu');
  assert.equal(await page.locator('#debug-sheet #btn-save-artwork').isEnabled(), true, 'ready artwork can be saved from the menu');
  const [saved] = await Promise.all([page.waitForEvent('download'), page.locator('#debug-sheet').getByRole('button', { name: 'Save artwork', exact: true }).click()]);
  await closeReportMenu(page);
  assert.equal(await saved.failure(), null, 'artwork download succeeds');
  assert.equal(saved.suggestedFilename(), 'pulse-painting.png', 'artwork filename');
  const png = readFileSync(await saved.path());
  assert.equal(png.subarray(1, 4).toString(), 'PNG', 'artwork is a PNG');
  assert.equal(png.readUInt32BE(16), 1080, 'downloaded portrait width');
  assert.equal(png.readUInt32BE(20), 1350, 'downloaded portrait height');
  assertArtworkPngPrivacy(png);
  if (output) { mkdirSync(output, {recursive:true}); writeFileSync(`${output}/portrait.png`, png); }
  assert.equal(hash(png), hash(Buffer.from(captured.image.split(',')[1], 'base64')), 'export uses the exact preview pixels');

  await checkbox.check();
  await page.waitForFunction(() => PulsePortrait.getState().ready && PulsePortrait.getState().includeMetrics);
  assert.notEqual(hash(await canvas.evaluate(node => node.toDataURL())), hash(captured.image), 'explicit metric opt-in changes the shared portrait');
  const metricsArt = await canvas.evaluate(node => {
    const crop = document.createElement('canvas'); crop.width = crop.height = 1000;
    crop.getContext('2d').drawImage(node, 40, 146, 1000, 1000, 0, 0, 1000, 1000);
    return crop.toDataURL();
  });
  assert.equal(hash(metricsArt), hash(captured.art), 'metric opt-in only changes the footer and leaves every landscape pixel unchanged');
  await checkbox.uncheck();
  await page.waitForFunction(() => PulsePortrait.getState().ready && !PulsePortrait.getState().includeMetrics);
  assert.equal(hash(await canvas.evaluate(node => node.toDataURL())), hash(captured.image), 'regenerating the default portrait preserves its exact seeded composition');

  await page.evaluate(() => {
    window.__portraitShareOriginal = Object.fromEntries(['canShare', 'share'].map(name => [name, Object.getOwnPropertyDescriptor(navigator, name)]));
    window.__portraitShareCalls = [];
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: data => !!data.files?.length });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
      const file = data.files[0];
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      window.__portraitShareCalls.push({
        keys: Object.keys(data).sort(), title: data.title, name: file.name, type: file.type, size: file.size,
        digest: [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join(''),
      });
      await new Promise(resolve => { window.__portraitShareResolve = resolve; });
    } });
  });
  try {
    await page.getByRole('button', { name: 'Share artwork', exact: true }).click();
    await page.waitForFunction(() => window.__portraitShareCalls.length === 1);
    const [shared] = await page.evaluate(() => window.__portraitShareCalls);
    assert.deepEqual(shared.keys, ['files', 'title'], 'native sharing contains only the requested artwork and title');
    assert.equal(shared.name, 'pulse-painting.png');
    assert.equal(shared.title, 'Pulse Painting', 'native share uses the current product name');
    assert.equal(shared.type, 'image/png');
    assert.equal(shared.size, png.length);
    assert.equal(shared.digest, hash(png), 'native sharing uses the same cached PNG as Save artwork');
    assert.equal(await page.locator('#btn-share-artwork').isDisabled(), true, 'floating Share artwork is disabled while the native share operation is pending');
    await page.evaluate(() => window.__portraitShareResolve());
    await page.waitForFunction(() => document.querySelector('.portrait-status').textContent === 'Artwork shared.');
    await page.waitForFunction(() => !document.querySelector('#btn-share-artwork').disabled);

    await page.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: () => Promise.reject(new DOMException('Cancelled', 'AbortError')) }));
    await page.getByRole('button', { name: 'Share artwork', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#btn-share-artwork').disabled && document.querySelector('.portrait-status').textContent === '');
    assert.equal(await page.locator('.portrait-status').textContent(), '', 'cancelling the native share sheet is quiet');

    await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }));
    const [fallback] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Share artwork', exact: true }).click()]);
    assert.equal(await fallback.failure(), null, 'unsupported native file sharing falls back to a downloadable artwork');
    assert.equal(hash(readFileSync(await fallback.path())), hash(png), 'fallback download preserves the artwork');
  } finally {
    await page.evaluate(() => {
      window.__portraitShareResolve?.();
      for (const name of ['canShare', 'share']) {
        const descriptor = window.__portraitShareOriginal[name];
        if (descriptor) Object.defineProperty(navigator, name, descriptor); else delete navigator[name];
      }
      delete window.__portraitShareOriginal; delete window.__portraitShareCalls; delete window.__portraitShareResolve;
    });
  }
  assert.equal(await page.locator('#debug-sheet #btn-save-report').count(), 1, 'scientific report export stays separate in the menu');
  assert.equal(await page.getByRole('button', { name: 'Measure again', exact: true }).count(), 1, 'report retains a separate new-measurement action');
  await page.evaluate(() => {
    window.__artworkOriginalPrint = Object.getOwnPropertyDescriptor(window, 'print');
    Object.defineProperty(window, 'print', { configurable: true, value: () => {
      window.__artworkPrint = {
        menuHidden: document.getElementById('debug-sheet').hidden,
        detailsOpen: [...document.querySelectorAll('.report-disclosure,.time-details,.ans-methods')].every(details => details.open),
      };
      window.dispatchEvent(new Event('afterprint'));
    } });
  });
  try {
    await openReportMenu(page);
    await page.locator('#debug-sheet').getByRole('button', { name: 'Save report', exact: true }).click();
    await page.waitForFunction(() => window.__artworkPrint);
    assert.deepEqual(await page.evaluate(() => window.__artworkPrint), { menuHidden: true, detailsOpen: true }, 'Save report closes the options menu before printing the complete report');
  } finally {
    await page.evaluate(() => {
      if (window.__artworkOriginalPrint) Object.defineProperty(window, 'print', window.__artworkOriginalPrint);
      else delete window.print;
      delete window.__artworkOriginalPrint; delete window.__artworkPrint;
    });
    await closeReportMenu(page);
  }
  return { width: 1080, height: 1350, family: captured.state.family, seed: captured.state.seed, strokeCount: captured.state.strokeCount, usableSeconds: captured.state.usableSeconds, durationSec: captured.state.durationSec, bytes: png.length, recovery, nativeShareScope: 'mocked browser API only' };
}
