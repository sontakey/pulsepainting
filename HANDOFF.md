# Pulse Painting handoff

## Scope

Pulse Painting has been extracted from the ppg-js camera application at source commit `732e1ef51f76bce9145bb7f666f92a30be5e0181`. The app owns capture presentation, painting, reports, and exports; ppg-js retains scientific and camera-acquisition source.

The present app paints a scrolling manuscript and creates a selected-moment portrait. Landscape families, data-driven density, and a continuous brush close-up → landscape reveal remain proposed design work. Do not present them as shipped.

## Runtime and build

Use Node 24, `npm ci`, and `npm run build`. The complete static output is `dist/`. The optional compositor is built with Three.js 0.186.1. Runtime HTML references remain relative, and optional assets resolve from the current script URL.

The pinned library artifact is the exact tested 0.3.1 browser bundle from the extraction commit; its SHA-256 is verified by the build. npm 0.3.1 publication is deliberately pending. Keep this documented artifact until a published replacement passes the existing lifecycle checks. No npm publication or library-source fork is part of this extraction.

## Deployment boundary

GitHub target: `sontakey/pulsepainting`.

The ChatPPG host integrates this repository separately as `apps/pulsepainting`, runs its build, and publishes `dist/` under `/pulse-painting/v-<contenthash>/`. The canonical HTML route is `https://chatppg.com/pulse-painting`; the ppg-js library demo remains separate at `/ppg-js-demo`. The host owns metadata, submodule pinning, cache invalidation, and deployment.

The new domain `pulsepainting.com` is planned. DNS, TLS, hosting attachment, and redirects have not been configured by the extraction. Keep current links and the painted QR pointed at the ChatPPG route until that domain is verified.

## Verification status

The standalone build, app capture/report/export regression suite, and both GPU fallback cases passed against this repository's built output. README screenshots were regenerated from this app. A full 180-second active WebKit session with interruption recovery and the regenerated QR suite are running before the production gate. Public ChatPPG deployment is still owned by the host repository and is not established by this commit.

Physical iPhone capture, camera/flash behavior, sustained thermal performance, and native share-sheet acceptance remain separate from browser replay checks.
