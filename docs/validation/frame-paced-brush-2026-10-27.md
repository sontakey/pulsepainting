# Brush timing at low display cadence

Live drawing previously advanced at most 33.33ms of accepted source per frame.
At 20fps that limits the brush to two thirds of normal speed and accumulates
delay, even when the renderer already has accepted samples available.

Ordinary frame intervals up to 250ms now advance the brush by their actual
elapsed time, at no more than real-time speed. Brush returns use the same clock.
Intervals longer than 250ms resume with a bounded 33.33ms step, preserving the
existing interruption behavior instead of rushing through a backlog. Intentional
row returns, signal validation and real source gaps still introduce their own
delay. This does not claim to eliminate all capture-to-paint latency.

The pigment paths, masks, source samples, camera configuration, quality gating,
canonical landscape and keepsake rendering are unchanged. Ambient and final
reveal clocks retain their existing 64ms cap. The local debug renderer identity
is `live-paper-2026-10-27-frame-paced`.

Chromium and WebKit timing checks pass all sixteen scenes. New regression cases
verify exact real-time source advancement at 15, 20 and 25fps and uneven
40/59/100/200ms intervals. The two-second stall, waiting-for-source, rejected
windows and late accepted delivery retain their previous bounded behavior.
The same new regression fails the preceding renderer at 15fps: 0.4 source
seconds advanced over 0.8 elapsed seconds. The fixed renderer advances 0.8.

Full WebKit replay with browser video passed 180.392 active measuring seconds
in 209.857 wall seconds, including camera pause, a 2.5-second main-thread stall
and hidden-page recovery. First resumed capture callbacks credited zero stale
time. Painting averaged 57.29fps (p95 25ms; maximum 228ms, including screenshot
overhead); reveal averaged 59.06fps. Report, waveform export and keepsake recovery
passed, with zero canonical scene pixel difference. Metric toggling changed only
the reserved metric band. All 49 gallery images were actually regenerated and
remain byte-identical; only the generated renderer provenance hash changes.

This is a source playback timing correction, not proof of improved iPhone FPS.
Browser replay does not validate phone camera, screen-recording or thermal load.
Private debug recordings are not committed.
