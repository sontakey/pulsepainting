# Standalone extraction validation — 2026-10-21

The app was extracted from ppg-js commit `732e1ef51f76bce9145bb7f666f92a30be5e0181`; initial standalone source is `397adfce6ef5ad530fec5daaaecc005310a2e22e`. Tests below exercised the standalone `dist/` output, not the old repository path.

| Check | Result |
| --- | --- |
| Pinned library provenance | SHA-256 `b7fdadb68fa32a1e3e36c1d792b5a3cabac9565c6182368d78589406c52374be` verified during build |
| Build | Pass, complete static output with local runtime assets |
| App replay | Pass: accepted geometry, live metrics, responsive widths, report chart labels, exports, native-share mocks, no-data handling |
| GPU fallback | Pass: blocked compositor and real WebGL2 context loss keep measured painting visible and continue capture |
| Full session | Pass: 180.489 s active measurement; 210.059 s wall time; automatic report completion |
| Interruptions | Camera-frame pause, main-thread stall, and simulated hidden-page interval recovered; no held or stale-frame catch-up time credited |
| Active painting | 59.67 fps average; p95 frame interval 18 ms; max 63 ms; 35 of 8,505 intervals exceeded 33.34 ms |
| Full-session report | Mean pulse 71 bpm, RMSSD 54.0 ms, SDNN 51.5 ms, 193 accepted beats from the public replay fixture |
| Manuscript export | 1200 × 5920 PNG; portrait/share tests also passed |
| Runtime errors | No page errors, console errors, or first-party failed requests during full replay |
| Painted QR | New version-4 Q matrix encodes `https://chatppg.com/pulse-painting`; 66/66 rendered-browser decode/perturbation variants passed |
| QR invitation | 21/21 measured text-contrast checks passed at 320, 634, and 1440 px; decorative QR/wash assets excluded from the phone flow |

Camera input is mocked. The full-session fixture is the already-public `test/fixtures/iphone-200s.json`; its final minute is repeated with shifted timestamps when needed to complete active measurement after interruptions, as documented in the test. This is not a new physiological recording or physical iPhone validation. Frame results describe this desktop WebKit run with iPhone emulation, not a guaranteed phone frame rate.

Reproduce with `npm test`, `npm run test:safari-session`, and `npm run test:qr` after building. QR decoding needs a Python environment with OpenCV, Pillow, and NumPy, selected through `PPG_PYTHON` when needed. Local raw browser artifacts are ignored under `.dream-loop/`.

GitHub CI is a separate gate. The initial run was stopped during prolonged dependency installation; the workflow now bounds install retries and timeouts and omits the unrelated npm audit network request. The host must also build its separate integration, deploy, and verify public routes before calling the split live.

Landscape scenes, adaptive scene density, emotional mappings, and a close-up-to-landscape zoom reveal are design proposals only. The dedicated domain is not connected by this extraction.
