# Working on Pulse Painting

Read `HANDOFF.md` before changing deployment or data behavior. This repository is the art application; `sontakey/ppg-js` remains the scientific library.

- Use `rtk` for shell commands when available in the working environment.
- Preserve measured source geometry and quality attribution. Never manufacture accepted beats or imply that color or aesthetic quality measures health.
- Keep the floating mobile controls, one brush heading per screen, readable supporting text, and reduced-motion behavior.
- The vendor artifact is temporary and immutable: verify its manifest, do not edit minified library code, and do not downgrade to npm 0.3.0. Upgrade only after a tested package version is actually published.
- Keep private recordings, credentials, local browser traces, and generated test output out of Git. The checked-in replay fixture was already public in ppg-js.
- `npm run build` must produce a self-contained static `dist/` with relative runtime references. The ChatPPG publisher places that runtime beneath one content-hashed directory.
- For capture or lifecycle changes, run the full WebKit session with interruption recovery. For copy or layout changes, run the app suite and inspect relevant mobile layouts and exported artwork.
- Browser replay, physical-phone validation, a local build, GitHub publication, and public deployment are separate statuses. Report them accurately.
- `pulsepainting.com` is planned, not an assumed active destination. The interim host route is `https://chatppg.com/pulse-painting`.
