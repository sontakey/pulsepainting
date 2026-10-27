import assert from 'node:assert/strict';

// UI contract only: the pinned engine remains responsible for signal quality.
// These injected cases cover display freshness and feedback, not medical accuracy.
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
      const read = () => {
        const track = document.getElementById('signal-quality-track');
        return {
          value: document.getElementById('signal-value').textContent.trim(),
          status: document.getElementById('quality-text').textContent.trim(),
          measuredAt: signalMeasuredAt,
          meter: track.getAttribute('aria-valuenow'),
          description: track.getAttribute('aria-valuetext'),
          fill: document.getElementById('signal-quality-fill').style.transform,
          unavailable: track.classList.contains('unavailable'),
        };
      };
      const metrics = (t, qualityScore = 82.6, other = {}) => ({
        t, fingerState: 'MEASURING', quality: { good: true }, gap: false,
        qualityScore, ...other,
      });
      const apply = value => { updateLiveSignal(value); return read(); };
      resetLiveSignal();
      const reset = read();
      const valid = [
        apply(metrics(1)),
        apply(metrics(2, 41.2)),
        apply(metrics(3, 96.8)),
        apply(metrics(4, 0)),
        apply(metrics(5, -10)),
        apply(metrics(6, 125)),
      ];
      let time = 6;
      const unavailable = [
        ['missing', undefined], ['null', null], ['NaN', NaN],
        ['infinite', Infinity], ['string', '88'],
      ].map(([name, qualityScore]) => ({ name, ...apply({ ...metrics(++time), qualityScore }) }));
      const rejected = [
        ['bad quality', { quality: { good: false, code: 'motion' } }],
        ['missing quality', { quality: null }],
      ].map(([name, other]) => ({ name, ...apply(metrics(++time, 99, other)) }));
      const gap = apply(metrics(++time, 99, { gap: true }));
      const invalidTime = [NaN, Infinity, undefined].map(t => apply(metrics(t)));

      resetLiveSignal();
      const initial = apply(metrics(100, 88));
      const duplicate = apply(metrics(100, 99));
      const older = apply(metrics(99, 100));
      // A newly delivered duplicate cannot make an expired measurement fresh.
      apply(metrics(101, 92));
      signalMeasuredAt = performance.now() - 2501;
      expireLiveSignal();
      const expired = read();
      const expiredDuplicate = apply(metrics(101, 100));
      const recovered = apply(metrics(102, 72.8));
      const rejectedDuplicate = apply(metrics(102, 100, { quality: { good: false, code: 'motion' } }));
      const rejectedDuplicateRecovery = apply(metrics(102, 100));
      const freshAfterRejection = apply(metrics(103, 86));

      resetLiveSignal();
      apply(metrics(200, 87));
      monitor.options.onSignalUpdate({ time: 201, value: 0, isProcessing: false });
      const nonprocessing = read();
      const nonprocessingDuplicate = apply(metrics(200));
      const nonprocessingRecovery = apply(metrics(202, 66.8));

      resetLiveSignal();
      apply(metrics(300, 89));
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
        visibleDuplicate = apply(metrics(301));
        visibilityRecovery = apply(metrics(302, 94.2));
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
      const card = document.getElementById('signal-value').closest('.live-metric');
      const track = document.getElementById('signal-quality-track');
      return {
        reset, valid, unavailable, rejected, gap, invalidTime,
        initial, duplicate, older, expired, expiredDuplicate, recovered, rejectedDuplicate, rejectedDuplicateRecovery, freshAfterRejection,
        nonprocessing, nonprocessingDuplicate, nonprocessingRecovery,
        hidden, hiddenUpdate, visible, visibleDuplicate, visibilityRecovery,
        mainLabels: Array.from(document.querySelectorAll('.live-metrics .metric-label'), el => el.textContent.trim()),
        signalUnit: card?.querySelector('.metric-unit')?.textContent.trim(),
        meterSemantics: { role: track.getAttribute('role'), min: track.getAttribute('aria-valuemin'), max: track.getAttribute('aria-valuemax') },
        liveAnnouncements: !!card.closest('[aria-live]') || !!card.querySelector('[aria-live]'),
        breathingTile: !!document.getElementById('resp-value'),
        signalMeterCount: document.querySelectorAll('#screen-measuring [role="meter"]').length,
        headerMeter: !!document.getElementById('signal-meter'),
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
    const empty = value => {
      assert.equal(value.value, '--');
      assert.equal(value.status, 'Finding signal');
      assert.equal(value.meter, '0');
      assert.equal(value.fill, 'scaleX(0)');
      assert.equal(value.description, 'Signal quality unavailable');
      assert.equal(value.unavailable, true);
      assert.equal(value.measuredAt, null);
    };
    empty(result.reset);
    assert.deepEqual(result.valid.map(reading), [
      { value: '83', status: '' }, { value: '41', status: '' }, { value: '97', status: '' },
      { value: '0', status: '' }, { value: '0', status: '' }, { value: '100', status: '' },
    ], 'successive real scores update and remain within the 0–100 range');
    for (const value of result.valid) {
      assert.equal(value.meter, value.value);
      assert.equal(value.fill, `scaleX(${Number(value.value) / 100})`);
      assert.equal(value.description, `${value.value} out of 100`);
      assert.equal(value.unavailable, false);
    }
    for (const value of result.unavailable) empty(value);
    assert.deepEqual(result.rejected.map(reading), [
      { value: '0', status: 'Hold still' }, { value: '0', status: 'Finding signal' },
    ], 'rejected windows cannot present their underlying high score as usable signal');
    for (const value of result.rejected) {
      assert.equal(value.fill, 'scaleX(0)');
      assert.equal(value.unavailable, true, 'a rejected score clears the bar immediately');
    }
    empty(result.gap);
    for (const value of result.invalidTime) empty(value);
    assert.deepEqual(result.duplicate, result.initial, 'a repeated window changes neither the score nor its freshness timestamp');
    assert.deepEqual(result.older, result.initial, 'an older window cannot replace a newer score');
    empty(result.expired);
    empty(result.expiredDuplicate);
    assert.deepEqual(reading(result.recovered), { value: '73', status: '' }, 'a fresh accepted window restores signal quality');
    empty(result.rejectedDuplicate);
    empty(result.rejectedDuplicateRecovery);
    assert.deepEqual(reading(result.freshAfterRejection), { value: '86', status: '' });
    for (const key of ['nonprocessing', 'nonprocessingDuplicate', 'hidden', 'hiddenUpdate', 'visible', 'visibleDuplicate']) empty(result[key]);
    assert.deepEqual(reading(result.nonprocessingRecovery), { value: '67', status: '' });
    assert.deepEqual(reading(result.visibilityRecovery), { value: '94', status: '' });
    assert.deepEqual(result.mainLabels, ['Pulse', 'HRV', 'Signal'], 'signal quality replaces the sparse breathing tile');
    assert.equal(result.signalUnit, '/100');
    assert.deepEqual(result.meterSemantics, { role: 'meter', min: '0', max: '100' });
    assert.equal(result.liveAnnouncements, false, 'the changing numeric score does not continuously announce itself');
    assert.equal(result.breathingTile, false);
    assert.equal(result.signalMeterCount, 1, 'capture presents signal quality once');
    assert.equal(result.headerMeter, false, 'camera preview does not duplicate the metric meter');
    assert.equal(result.oldFloor, false, 'capture details omit the technical timing-floor output');
    assert.ok(result.detailCopy.split(/\s+/).filter(Boolean).length <= 65, 'capture explanation stays brief');
    assert.doesNotMatch(result.detailCopy, /timing.noise floor|five.second signal check|deeper pigment/i, 'capture details omit the old technical explanation');
    assert.ok(result.preview, 'raw signal charts have a dedicated optional preview');
    assert.deepEqual(result.preview, {
      hidden: true, expanded: 'false', controls: 'signal-preview', waveInside: true, timingInside: true,
    }, 'raw charts are hidden by default and the preview has an accessible toggle');

    const motion = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
    try {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const transitions = await page.evaluate(() => {
        resetLiveSignal();
        updateLiveSignal({ t: 400, qualityScore: 84, quality: { good: true } });
        const duration = () => getComputedStyle(document.getElementById('signal-quality-fill')).transitionDuration;
        const good = duration();
        clearLiveSignal();
        return { good, unavailable: duration() };
      });
      assert.ok(transitions.good.split(',').some(value => parseFloat(value) > 0), 'valid signal updates ease between measured values');
      assert.ok(transitions.unavailable.split(',').every(value => parseFloat(value) === 0), 'lost signal clears without lingering strong pigment');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const reduced = await page.evaluate(() => {
        updateLiveSignal({ t: 401, qualityScore: 90, quality: { good: true } });
        return getComputedStyle(document.getElementById('signal-quality-fill')).transitionDuration;
      });
      assert.ok(reduced.split(',').every(value => parseFloat(value) === 0), 'reduced motion disables quality meter easing');
    } finally {
      await page.emulateMedia({ reducedMotion: motion ? 'reduce' : 'no-preference' });
    }

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
      resetLiveSignal();
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
