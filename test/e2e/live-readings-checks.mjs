import assert from 'node:assert/strict';

// UI contract only: the pinned engine remains responsible for estimating
// breathing. These injected cases do not validate respiratory accuracy.
export async function checkLiveReadings(page) {
  const original = await page.evaluate(() => ({
    metrics: monitor?.getMetrics?.() || lastMetrics,
    lastMeasuringFrame,
    waveBuf: [...waveBuf], placementWaveBuf: [...placementWaveBuf],
    detailsOpen: document.querySelector('.live-details')?.open,
    previewHidden: document.getElementById('signal-preview')?.hidden,
    previewExpanded: document.getElementById('btn-signal-preview')?.getAttribute('aria-expanded'),
    scrollX, scrollY,
    report: document.getElementById('report-content')?.innerHTML,
  }));

  try {
    const result = await page.evaluate(() => {
      const read = () => ({
        value: document.getElementById('resp-value').textContent.trim(),
        status: document.getElementById('resp-status').textContent.trim(),
        measuredAt: breathingMeasuredAt,
      });
      const metrics = (t, respiration = {}, other = {}) => ({
        t, fingerState: 'MEASURING', quality: { good: true }, gap: false,
        respiration: { rateBpm: 13.6, confidence: 0.8, basis: 'agreement', ...respiration },
        ...other,
      });
      const apply = value => { updateLiveBreathing(value); return read(); };
      resetLiveBreathing();
      const reset = read();
      const valid = [
        apply(metrics(1)),
        apply(metrics(2, { rateBpm: 6.7, confidence: 0.5 })),
        apply(metrics(3, { rateBpm: 16.2 })),
      ];
      let time = 3;
      const unavailable = [
        ['missing', { respiration: null }],
        ['NaN', { respiration: { rateBpm: NaN, confidence: 0.8, basis: 'agreement' } }],
        ['infinite', { respiration: { rateBpm: Infinity, confidence: 0.8, basis: 'agreement' } }],
        ['zero', { respiration: { rateBpm: 0, confidence: 0.8, basis: 'agreement' } }],
        ['negative', { respiration: { rateBpm: -2, confidence: 0.8, basis: 'agreement' } }],
        ['string', { respiration: { rateBpm: '12', confidence: 0.8, basis: 'agreement' } }],
        ['NaN confidence', { respiration: { rateBpm: 12, confidence: NaN, basis: 'agreement' } }],
        ['infinite confidence', { respiration: { rateBpm: 12, confidence: Infinity, basis: 'agreement' } }],
        ['low confidence', { respiration: { rateBpm: 12, confidence: 0.49, basis: 'agreement' } }],
        ['single', { respiration: { rateBpm: 12, confidence: 0.3, basis: 'single' } }],
        ['held', { respiration: { rateBpm: 12, confidence: 0.4, basis: 'held' } }],
        ['disagreement', { respiration: { rateBpm: 12, confidence: 0.8, basis: null } }],
      ].map(([name, other]) => ({ name, ...apply(metrics(++time, {}, other)) }));
      const rejected = [
        ['bad quality', { quality: { good: false, code: 'motion' } }],
        ['missing quality', { quality: null }],
        ['gap', { gap: true }],
      ].map(([name, other]) => ({ name, ...apply(metrics(++time, {}, other)) }));
      const invalidTime = [NaN, Infinity, undefined].map(t => apply(metrics(t)));

      resetLiveBreathing();
      const initial = apply(metrics(100, { rateBpm: 14 }));
      const duplicate = apply(metrics(100, { rateBpm: 25 }));
      const older = apply(metrics(99, { rateBpm: 26 }));
      // A newly delivered duplicate cannot make an expired measurement fresh.
      apply(metrics(101, { rateBpm: 18 }));
      breathingMeasuredAt = performance.now() - 2501;
      expireLiveBreathing();
      const expired = read();
      const expiredDuplicate = apply(metrics(101, { rateBpm: 28 }));
      const recovered = apply(metrics(102, { rateBpm: 20.8 }));

      resetLiveBreathing();
      apply(metrics(200, { rateBpm: 15 }));
      monitor.options.onSignalUpdate({ time: 201, value: 0, isProcessing: false });
      const nonprocessing = read();
      const nonprocessingDuplicate = apply(metrics(200));
      const nonprocessingRecovery = apply(metrics(202, { rateBpm: 17.8 }));

      resetLiveBreathing();
      apply(metrics(300, { rateBpm: 15 }));
      const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');
      const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
      let hidden, hiddenUpdate, visible, visibleDuplicate, visibilityRecovery;
      try {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
        hidden = read();
        hiddenUpdate = apply(metrics(301));
        Object.defineProperty(document, 'hidden', { configurable: true, value: false });
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
        document.dispatchEvent(new Event('visibilitychange'));
        visible = read();
        visibleDuplicate = apply(metrics(300));
        visibilityRecovery = apply(metrics(302, { rateBpm: 17.2 }));
      } finally {
        if (hiddenDescriptor) Object.defineProperty(document, 'hidden', hiddenDescriptor);
        else delete document.hidden;
        if (visibilityDescriptor) Object.defineProperty(document, 'visibilityState', visibilityDescriptor);
        else delete document.visibilityState;
        document.dispatchEvent(new Event('visibilitychange'));
      }
      const body = document.querySelector('.live-details-body');
      const preview = document.getElementById('signal-preview');
      const toggle = document.getElementById('btn-signal-preview');
      const card = document.getElementById('resp-value').closest('.live-metric');
      return {
        reset, valid, unavailable, rejected, invalidTime,
        initial, duplicate, older, expired, expiredDuplicate, recovered,
        nonprocessing, nonprocessingDuplicate, nonprocessingRecovery,
        hidden, hiddenUpdate, visible, visibleDuplicate, visibilityRecovery,
        mainLabels: Array.from(document.querySelectorAll('.live-metrics .metric-label'), el => el.textContent.trim()),
        breathingUnit: card?.querySelector('.metric-unit')?.textContent.trim(),
        detailCopy: body?.textContent.trim() || '',
        oldFloor: !!document.querySelector('#screen-measuring #rmssd-floor'),
        preview: preview && toggle ? {
          hidden: preview.hidden, expanded: toggle.getAttribute('aria-expanded'),
          controls: toggle.getAttribute('aria-controls'),
          waveInside: preview.contains(document.getElementById('wave-canvas')),
          timingInside: preview.contains(document.getElementById('tacho-canvas')),
        } : null,
      };
    });
    const reading = value => ({ value: value.value, status: value.status });
    assert.equal(result.reset.value, '--', 'reset clears breathing from the previous reading');
    assert.deepEqual(result.valid.map(reading), [
      { value: '14', status: 'Estimated' },
      { value: '7', status: 'Estimated' },
      { value: '16', status: 'Estimated' },
    ], 'successive agreed windows update the numeric breathing rate');
    for (const value of result.unavailable) {
      assert.deepEqual(reading(value), { value: '--', status: 'Estimating' }, `${value.name}: unreliable breathing is withheld`);
    }
    for (const value of result.rejected) {
      assert.deepEqual(reading(value), { value: '--', status: 'Finding signal' }, `${value.name}: current quality gates breathing`);
    }
    for (const value of result.invalidTime) assert.equal(value.value, '--', 'a nonfinite window timestamp cannot publish breathing');
    assert.deepEqual(result.duplicate, result.initial, 'a repeated window changes neither the number nor its freshness timestamp');
    assert.ok(['14', '--'].includes(result.older.value), 'an older window is ignored or clears the tile, never overwrites the newer value');
    assert.deepEqual(reading(result.expired), { value: '--', status: 'Finding signal' }, 'breathing expires after 2500 ms without a fresh window');
    assert.equal(result.expiredDuplicate.value, '--', 'a duplicate callback cannot resurrect an expired value');
    assert.deepEqual(reading(result.recovered), { value: '21', status: 'Estimated' }, 'a fresh accepted window restores breathing');
    for (const key of ['nonprocessing', 'nonprocessingDuplicate', 'hidden', 'hiddenUpdate', 'visible', 'visibleDuplicate']) {
      assert.equal(result[key].value, '--', `${key}: interrupted capture never displays an old breathing rate`);
    }
    assert.deepEqual(reading(result.nonprocessingRecovery), { value: '18', status: 'Estimated' });
    assert.deepEqual(reading(result.visibilityRecovery), { value: '17', status: 'Estimated' });
    assert.deepEqual(result.mainLabels, ['Pulse', 'HRV', 'Breathing'], 'breathing replaces SDNN in the primary readings');
    assert.equal(result.breathingUnit, '/min');
    assert.equal(result.oldFloor, false, 'capture details omit the technical timing-floor output');
    assert.ok(result.detailCopy.split(/\s+/).filter(Boolean).length <= 65, 'capture explanation stays brief');
    assert.doesNotMatch(result.detailCopy, /timing.noise floor|five.second signal check|deeper pigment/i, 'capture details omit the old technical explanation');
    assert.ok(result.preview, 'raw signal charts have a dedicated optional preview');
    assert.deepEqual(result.preview, {
      hidden: true, expanded: 'false', controls: 'signal-preview', waveInside: true, timingInside: true,
    }, 'raw charts are hidden by default and the preview has an accessible toggle');

    const details = page.locator('.live-details');
    if (await details.count()) await details.evaluate(el => { el.open = true; });
    const toggle = page.locator('#btn-signal-preview');
    await toggle.click();
    assert.equal(await page.locator('#signal-preview').isVisible(), true, 'signal preview opens on request');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    await toggle.click();
    assert.equal(await page.locator('#signal-preview').isHidden(), true, 'signal preview can be hidden again');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('#report-content').innerHTML(), original.report, 'changing live readings leaves the report untouched');
  } finally {
    await page.evaluate(saved => {
      resetLiveBreathing();
      if (saved.metrics) updateMeasuringScreen(saved.metrics);
      lastMeasuringFrame = saved.lastMeasuringFrame;
      waveBuf.splice(0, waveBuf.length, ...saved.waveBuf);
      placementWaveBuf.splice(0, placementWaveBuf.length, ...saved.placementWaveBuf);
      const details = document.querySelector('.live-details');
      if (details && typeof saved.detailsOpen === 'boolean') details.open = saved.detailsOpen;
      const preview = document.getElementById('signal-preview');
      if (preview && typeof saved.previewHidden === 'boolean') preview.hidden = saved.previewHidden;
      const toggle = document.getElementById('btn-signal-preview');
      if (toggle && saved.previewExpanded != null) toggle.setAttribute('aria-expanded', saved.previewExpanded);
      scrollTo(saved.scrollX, saved.scrollY);
    }, original);
  }
}
