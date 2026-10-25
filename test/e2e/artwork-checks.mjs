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
    const textLayout = [];
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    let releaseFonts;
    const fontGate = new Promise(resolve => { releaseFonts = resolve; });
    try {
      CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
        if (this.canvas === host.querySelector('.portrait-preview canvas')) {
          const measured = this.measureText(text);
          const scale = maxWidth && measured.width > maxWidth ? maxWidth / measured.width : 1;
          textLayout.push({ text, x, y, font: this.font, align: this.textAlign,
            left: x - measured.actualBoundingBoxLeft * scale, right: x + measured.actualBoundingBoxRight * scale,
            top: y - measured.actualBoundingBoxAscent, bottom: y + measured.actualBoundingBoxDescent });
        }
        return originalFillText.apply(this, arguments);
      };
      Object.defineProperty(fonts, 'load', { configurable: true, value: () => fontGate });
      const mounting = PulsePortrait.mount(host, {
        landscape,
        segments: manuscript.segments,
        start: manuscript.segments[0].points[0].t,
        durationSec: elapsedMeasuringMs / 1000,
        startedAt: new Date(portraitStartedAt || Date.now()),
        pigmentAt,
        metrics: { hr: NaN, rmssd: Infinity, sdnn: null },
        shareButton, saveButton,
        paintRows: (canvas, rowIndices) => paintManuscriptRaster(canvas, false, true, null, true, { rowIndices }),
      });
      const checkbox = host.querySelector('.portrait-options input');
      const disabledWhilePreparing = checkbox.disabled && shareButton.disabled && saveButton.disabled;
      releaseFonts([]);
      const state = await mounting;
      const enabledWhenReady = !checkbox.disabled && !shareButton.disabled && !saveButton.disabled && PulsePortrait.getState(host).ready;
      const initialTextLayout = [...textLayout];
      const initialMetrics = checkbox.checked && PulsePortrait.getState(host).includeMetrics;
      checkbox.click();
      const disabledWhileRegenerating = shareButton.disabled && saveButton.disabled;
      await state.ready;
      const enabledAfterRegenerating = !shareButton.disabled && !saveButton.disabled && PulsePortrait.getState(host).ready;
      PulsePortrait.clear(host);
      const disabledAfterClear = shareButton.disabled && saveButton.disabled;
      return { disabledWhilePreparing, enabledWhenReady, disabledWhileRegenerating, enabledAfterRegenerating, disabledAfterClear, initialMetrics, textLayout: initialTextLayout,
        sceneName: PulseLandscape.FAMILIES.find(family => family.id === landscape.family)?.name || 'Your landscape' };
    } finally {
      CanvasRenderingContext2D.prototype.fillText = originalFillText;
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
  assert.equal(preparation.initialMetrics, true, 'local artwork includes its metric band by default');
  const title = preparation.textLayout.find(item => item.text === 'Pulse Painting');
  const sceneTitle = preparation.textLayout.find(item => item.text === preparation.sceneName);
  const footerURL = preparation.textLayout.find(item => item.text === 'PulsePainting.com');
  const footerDate = preparation.textLayout.find(item => /\b\d{4}\b/.test(item.text));
  assert.ok(title && title.top >= 36 && title.bottom < 190, 'brush brand title has real paper padding above and below');
  assert.ok(sceneTitle && /Water Brush/.test(sceneTitle.font) && sceneTitle.top >= 980 && sceneTitle.bottom <= 1056, 'cursive landscape name remains visible above the metric band');
  assert.ok(footerDate && Math.abs(footerDate.left - 72) < .1 && footerDate.top >= 1275 && footerDate.bottom <= 1309, 'recording date sits at the bottom left');
  assert.ok(footerURL && Math.abs(footerURL.right - 1008) < .1 && footerURL.top >= 1275 && footerURL.bottom <= 1309, 'website sits at the bottom right');
  assert.ok(footerDate.right < footerURL.left, 'date and website have distinct nonoverlapping footer areas');
  assert.ok(preparation.textLayout.every(item => item.left >= 36 && item.right <= 1044 && item.top >= 36 && item.bottom <= 1314), 'all exported labels remain inside the paper frame');
  assert.deepEqual(preparation.textLayout.filter(item => item.top >= 1138 && item.bottom <= 1182).map(item => item.text), ['—', '—', '—'], 'unavailable values stay visibly unavailable instead of showing NaN, Infinity or fabricated zeroes');
  const recovery = await page.evaluate(async () => {
    const outcomes=[];
    for (const mode of ['encoder', 'renderer']) {
      const host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;width:500px';document.body.append(host);
      const share=document.createElement('button'),save=document.createElement('button');
      const originalToBlob=HTMLCanvasElement.prototype.toBlob, originalLandscape=window.PulseLandscape;
      const sourceBefore=JSON.stringify(landscape);
      let renderCalls=0,successfulRenders=0,renderedArt=null;
      try {
        window.PulseLandscape={...originalLandscape,render(...args){
          if (args[2]?.through === 0) return originalLandscape.render(...args);
          renderCalls++;
          if(mode==='renderer'&&renderCalls===1)throw new Error('Test-only renderer failure');
          const result=originalLandscape.render(...args);successfulRenders++;renderedArt=args[1];return result;
        }};
        if(mode==='encoder')HTMLCanvasElement.prototype.toBlob=function(callback){callback(null);};
        const initialState=await PulsePortrait.mount(host,{landscape,durationSec:elapsedMeasuringMs/1000,startedAt:new Date(portraitStartedAt),shareButton:share,saveButton:save});
        const retry=host.querySelector('.portrait-retry');
        const held=retry&&!retry.hidden&&share.disabled&&save.disabled&&!PulsePortrait.getState(host).ready;
        const initialRenderCalls=renderCalls,initialSuccessfulRenders=successfulRenders;
        // Observe only after the encoder has failed. This is a retained-artifact
        // check, not a fresh-render parity or performance measurement.
        const originalArt=renderedArt;
        const originalPixels=originalArt?.getContext('2d').getImageData(0,0,originalArt.width,originalArt.height).data;
        HTMLCanvasElement.prototype.toBlob=originalToBlob;
        const retryStarted=performance.now();
        // PNG encoding is asynchronous; CI can still be preparing at five
        // seconds. Observe the terminal UI state instead of polling. This is a
        // bounded correctness wait; retryMs remains visible and mobile
        // performance is checked separately.
        const completion=await new Promise(resolve=>{
          const finish=result=>{clearTimeout(deadline);observer.disconnect();resolve(result);};
          const inspect=()=>{
            if(PulsePortrait.getState(host).ready)finish('ready');
            else if(!retry.hidden)finish('failed');
          };
          const observer=new MutationObserver(inspect);
          const deadline=setTimeout(()=>finish('timeout'),30000);
          observer.observe(host,{attributes:true,childList:true,subtree:true});
          retry.click();
          inspect();
        });
        const retryMs=performance.now()-retryStarted;
        let sourceArtMaxDelta=null;
        if(originalPixels&&renderedArt){
          const pixels=renderedArt.getContext('2d').getImageData(0,0,renderedArt.width,renderedArt.height).data;
          sourceArtMaxDelta=pixels.length===originalPixels.length?0:Infinity;
          for(let i=0;i<Math.min(pixels.length,originalPixels.length);i++)sourceArtMaxDelta=Math.max(sourceArtMaxDelta,Math.abs(pixels[i]-originalPixels[i]));
        }
        outcomes.push({mode,held,completion,ready:PulsePortrait.getState(host).ready,actionsEnabled:!share.disabled&&!save.disabled,sourceStable:sourceBefore===JSON.stringify(landscape),sameSeed:PulsePortrait.getState(host).seed===landscape.seed,family:landscape.family,retryMs,status:host.querySelector('.portrait-status')?.textContent,retryVisible:!retry.hidden,
          initialRenderCalls,initialSuccessfulRenders,renderCalls,successfulRenders,retainedArt:!!originalArt&&initialState?.art===originalArt&&renderedArt===originalArt,sourceArtMaxDelta});
      } finally {HTMLCanvasElement.prototype.toBlob=originalToBlob;window.PulseLandscape=originalLandscape;PulsePortrait.clear(host);host.remove();}
    }
    return outcomes;
  });
  console.log('ARTWORK_RECOVERY',JSON.stringify(recovery));
  for(const result of recovery){
    assert.equal(result.held,true, `${result.mode}: unavailable export offers retry and disables sharing`);
    assert.equal(result.completion,'ready', `${result.mode}: retry completes successfully within 30 seconds: ${JSON.stringify(result)}`);
    assert.equal(result.ready,true, `${result.mode}: retry prepares the original artwork`);
    assert.equal(result.actionsEnabled,true, `${result.mode}: recovered artwork enables sharing and saving`);
    assert.equal(result.retryVisible,false, `${result.mode}: successful recovery hides the retry action`);
    assert.equal(result.status,'', `${result.mode}: successful recovery clears the preparing message`);
    assert.ok(result.sourceStable&&result.sameSeed, `${result.mode}: failure and recovery preserve every source stroke and scene seed`);
    assert.equal(result.initialRenderCalls,1, `${result.mode}: initial preparation attempts the landscape once`);
    if(result.mode==='encoder'){
      assert.equal(result.initialSuccessfulRenders,1, 'encoder: the landscape succeeded before PNG encoding failed');
      assert.equal(result.renderCalls,1, 'encoder: retry reuses the completed landscape instead of rasterizing it again');
      assert.equal(result.successfulRenders,1, 'encoder: one completed landscape supplies both encoding attempts');
      assert.equal(result.retainedArt,true, 'encoder: retry retains the original artwork canvas');
      assert.equal(result.sourceArtMaxDelta,0, 'encoder: every retained source-art pixel survives the encoding retry unchanged');
    }else{
      assert.equal(result.initialSuccessfulRenders,0, 'renderer: failed preparation has no completed artwork to reuse');
      assert.equal(result.renderCalls,2, 'renderer: retry performs the required second landscape render');
      assert.equal(result.successfulRenders,1, 'renderer: recovery retains one successful landscape');
    }
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
    const {x, y, width, height} = state.artworkBounds;
    // Use the portrait's exact destination coordinates for both render paths.
    // Comparing a copied crop against an origin-aligned resample adds a second
    // backend-dependent rounding step that is unrelated to scene preservation.
    const expectedArt = document.createElement('canvas'); expectedArt.width=1080;expectedArt.height=1350;
    const expectedContext = expectedArt.getContext('2d');
    expectedContext.fillStyle = '#fbf8f0'; expectedContext.fillRect(0,0,1080,1350);
    const source = state.artworkSourceBounds, destination = state.artworkPlacement;
    expectedContext.drawImage(exact,source.x,source.y,source.width,source.height,destination.x,destination.y,destination.width,destination.height);
    const blank=document.createElement('canvas');blank.width=blank.height=1080;
    PulseLandscape.render(landscape,blank,{through:0});
    const exactPixels=exact.getContext('2d').getImageData(0,0,1080,1080).data,blankPixels=blank.getContext('2d').getImageData(0,0,1080,1080).data;
    let croppedPigmentPixels=0;
    for(let py=0;py<1080;py++)for(let px=0;px<1080;px++){
      if(px>=source.x&&px<source.x+source.width&&py>=source.y&&py<source.y+source.height)continue;
      const i=(py*1080+px)*4;
      if([0,1,2,3].some(c=>exactPixels[i+c]!==blankPixels[i+c]))croppedPigmentPixels++;
    }
    // Observe a 1:1 copy, never read back the live export canvas. Repeated
    // getImageData calls can trigger a Chromium GPU-to-CPU backend switch
    // before its next draw and change resampling solely because of the test.
    const observed=document.createElement('canvas');observed.width=1080;observed.height=1350;
    observed.getContext('2d').drawImage(portraitCanvas,0,0);
    const originalPixels=observed.getContext('2d').getImageData(0,0,1080,1350).data;
    const a=new Uint8ClampedArray(width*height*4),b=expectedArt.getContext('2d').getImageData(x,y,width,height).data;
    for(let row=0;row<height;row++)a.set(originalPixels.subarray(((row+y)*1080+x)*4,((row+y)*1080+x+width)*4),row*width*4);
    const portraitArt=document.createElement('canvas');portraitArt.width=width;portraitArt.height=height;
    portraitArt.getContext('2d').drawImage(portraitCanvas,x,y,width,height,0,0,width,height);
    let maxArtDelta=0, artDelta=0, deltaBounds={minY:height,maxY:0,minX:width,maxX:0};for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);maxArtDelta=Math.max(maxArtDelta,d);artDelta+=d;if(d>2){const pixel=Math.floor(i/4),x=pixel%width,y=Math.floor(pixel/width);deltaBounds.minX=Math.min(deltaBounds.minX,x);deltaBounds.maxX=Math.max(deltaBounds.maxX,x);deltaBounds.minY=Math.min(deltaBounds.minY,y);deltaBounds.maxY=Math.max(deltaBounds.maxY,y);}}
    const border = [[20,20],[1060,20],[20,1330],[1060,1330],[20,650],[1060,650],[540,20],[540,1330]].map(([x,y]) => [...originalPixels.subarray((y*1080+x)*4,(y*1080+x)*4+4)]);
    window.__artworkDefaultPixels = originalPixels;

    return {
      state, expectedDuration: elapsedMeasuringMs / 1000,
      scene: { family: landscape.family, seed: landscape.seed, version: landscape.version, strokeCount: landscape.strokes.length, usableSeconds: landscape.usableSeconds },
      sourceUnchanged: sceneBefore === JSON.stringify(landscape),
      art: portraitArt.toDataURL(), maxArtDelta, meanArtDelta:artDelta/a.length, deltaBounds, border, croppedPigmentPixels,
      image: document.querySelector('.portrait-preview canvas').toDataURL(),
      accessibleDescription: document.querySelector('.portrait-preview canvas').getAttribute('aria-label'),
    };
  });
  assert.equal(captured.state.width, 1080, 'share artwork width');
  assert.equal(captured.state.height, 1350, 'share artwork height');
  assert.equal(captured.state.durationSec, captured.expectedDuration, 'portrait uses actual active capture duration, including early finishes');
  assert.deepEqual(captured.state.artworkViewport, { x:56, y:190, width:968, height:752 }, 'artwork has a wider composition area above its padded name');
  const source=captured.state.artworkSourceBounds, destination=captured.state.artworkPlacement, viewport=captured.state.artworkViewport;
  assert.ok(source.x>=0&&source.y>=0&&source.x+source.width<=1080&&source.y+source.height<=1080, 'artwork source bounds remain within the original square');
  assert.ok(Math.abs(destination.width/source.width-destination.height/source.height)<1e-9, 'source aspect ratio is preserved without stretching');
  assert.ok(destination.x>=viewport.x-1e-8&&destination.y>=viewport.y-1e-8&&destination.x+destination.width<=viewport.x+viewport.width+1e-8&&destination.y+destination.height<=viewport.y+viewport.height+1e-8, 'measured artwork fits inside its composition area');
  assert.equal(captured.croppedPigmentPixels,0,'only identical unpainted paper is removed; every changed pigment pixel remains');
  if(captured.state.family==='aurora-night')assert.deepEqual(source,{x:0,y:0,width:1080,height:1080},'the aurora composition preserves its complete night sky');
  assert.ok(captured.border.every(([r,g,b,a]) => r >= 245 && g >= 240 && b >= 230 && r > b && a === 255), 'warm opaque paper surrounds the entire card');
  assert.equal(captured.state.includeMetrics, true, 'numeric metrics are included in the local shared artwork by default');
  assert.equal(await checkbox.isChecked(), true, 'local metrics inclusion starts checked');
  assert.match(captured.accessibleDescription, /landscape|pulse/i, 'artwork has an accessible description');
  for (const key of ['family', 'seed', 'version', 'strokeCount', 'usableSeconds'])
    assert.equal(captured.state[key], captured.scene[key], `portrait retains capture scene ${key}`);
  assert.ok(captured.state.strokeCount > 0 && captured.state.usableSeconds > 0, 'personal landscape contains accepted data');
  assert.equal(captured.sourceUnchanged, true, 'export never mutates the private source descriptor');
  console.log('PORTRAIT_SCENE_PARITY',JSON.stringify({max:captured.maxArtDelta,mean:captured.meanArtDelta,bounds:captured.deltaBounds}));
  assert.ok(captured.maxArtDelta<=1&&captured.meanArtDelta<.01, 'portrait contains every original pigment pixel within one-level Canvas2D copy rounding, without scene re-layout or selected rows');

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

  await checkbox.uncheck();
  await page.waitForFunction(() => PulsePortrait.getState().ready && !PulsePortrait.getState().includeMetrics);
  assert.notEqual(hash(await canvas.evaluate(node => node.toDataURL())), hash(captured.image), 'turning metrics off changes the shared portrait');
  const toggled = await canvas.evaluate(node => {
    const state=PulsePortrait.getState(), {x,y,width,height}=state.artworkBounds;
    const crop = document.createElement('canvas'); crop.width = width; crop.height = height;
    crop.getContext('2d').drawImage(node,x,y,width,height,0,0,width,height);
    const observed=document.createElement('canvas');observed.width=1080;observed.height=1350;
    observed.getContext('2d').drawImage(node,0,0);
    const pixels = observed.getContext('2d').getImageData(0,0,1080,1350).data, original = window.__artworkDefaultPixels;
    let outsideBandChanges = 0, metricBandChanges = 0, maxOutsideDelta = 0;
    for(let offset=0;offset<pixels.length;offset+=4) {
      if(![0,1,2,3].some(channel=>pixels[offset+channel]!==original[offset+channel]))continue;
      const y=Math.floor(offset/4/1080);
      if(y>=state.metricBounds.y&&y<state.metricBounds.y+state.metricBounds.height)metricBandChanges++;else {outsideBandChanges++;for(let channel=0;channel<4;channel++)maxOutsideDelta=Math.max(maxOutsideDelta,Math.abs(pixels[offset+channel]-original[offset+channel]));}
    }
    delete window.__artworkDefaultPixels;
    return {art:crop.toDataURL(),outsideBandChanges,metricBandChanges,maxOutsideDelta,image:node.toDataURL()};
  });
  console.log('PORTRAIT_METRIC_TOGGLE',JSON.stringify({outsideBandChanges:toggled.outsideBandChanges,metricBandChanges:toggled.metricBandChanges,maxOutsideDelta:toggled.maxOutsideDelta}));
  if (output) writeFileSync(`${output}/portrait-without-metrics.png`, Buffer.from(toggled.image.split(',')[1], 'base64'));
  assert.equal(hash(toggled.art), hash(captured.art), 'metrics toggle leaves every landscape pixel unchanged');
  assert.equal(toggled.outsideBandChanges, 0, 'metrics toggle cannot move or erase the title, landscape name, date, website or paper frame');
  assert.ok(toggled.metricBandChanges > 0, 'metrics toggle removes only its numeric summary band');
  await checkbox.check();
  await page.waitForFunction(() => PulsePortrait.getState().ready && PulsePortrait.getState().includeMetrics);
  assert.equal(hash(await canvas.evaluate(node => node.toDataURL())), hash(captured.image), 'regenerating the default portrait preserves its exact seeded composition');

  await page.evaluate(() => {
    window.__portraitShareOriginal = Object.fromEntries(['canShare', 'share'].map(name => [name, Object.getOwnPropertyDescriptor(navigator, name)]));
    window.__portraitShareCalls = [];
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: data => !!data.files?.length });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
      const file = data.files[0];
      const userActivation = navigator.userActivation.isActive;
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      window.__portraitShareCalls.push({
        keys: Object.keys(data).sort(), title: data.title, name: file.name, type: file.type, size: file.size,
        userActivation,
        digest: [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join(''),
      });
      await new Promise(resolve => { window.__portraitShareResolve = resolve; });
    } });
  });
  try {
    await page.getByRole('button', { name: 'Share artwork', exact: true }).click();
    await page.waitForFunction(() => window.PulseShare?.getState().ready);
    assert.equal(await page.locator('.pulse-share-sheet').isVisible(), true, 'report opens the artwork-first sharing screen');
    await page.locator('.ps-art img').evaluate(image => image.decode());
    assert.equal(await page.locator('.ps-art img').isVisible(), true, 'the shared image is previewed before choosing an app');
    await page.locator('.ps-share').click();
    await page.waitForFunction(() => window.__portraitShareCalls.length === 1);
    const [shared] = await page.evaluate(() => window.__portraitShareCalls);
    assert.deepEqual(shared.keys, ['files', 'title'], 'native sharing contains only the requested artwork and title');
    assert.equal(shared.name, 'pulse-painting.png');
    assert.equal(shared.title, 'Pulse Painting', 'native share uses the current product name');
    assert.equal(shared.type, 'image/png');
    assert.equal(shared.size, png.length);
    assert.equal(shared.digest, hash(png), 'native sharing uses the same cached PNG as Save artwork');
    assert.equal(shared.userActivation, true, 'the prepared file is handed to native sharing in the user click');
    assert.equal(await page.locator('.ps-share').isDisabled(), true, 'the share action is disabled while native sharing is pending');
    await page.evaluate(() => window.__portraitShareResolve());
    await page.waitForFunction(() => document.querySelector('.ps-status').textContent.startsWith('Returned from sharing.'));
    await page.waitForFunction(() => !document.querySelector('.ps-share').disabled);

    await page.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: () => Promise.reject(new DOMException('Cancelled', 'AbortError')) }));
    await page.locator('.ps-share').click();
    await page.waitForFunction(() => !document.querySelector('.ps-share').disabled && document.querySelector('.ps-status').textContent === '');
    assert.equal(await page.locator('.ps-status').textContent(), '', 'cancelling the native share sheet is quiet');

    await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }));
    const [fallback] = await Promise.all([page.waitForEvent('download'), page.locator('.ps-share').click()]);
    assert.equal(await fallback.failure(), null, 'unsupported native file sharing falls back to a downloadable artwork');
    assert.equal(hash(readFileSync(await fallback.path())), hash(png), 'fallback download preserves the artwork');
  } finally {
    await page.evaluate(() => {
      window.PulseShare?.close();
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
