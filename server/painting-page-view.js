import { escapeHTML } from './http.js';

// A readable, script-free arrival page for people following a shared painting.
export function paintingPage(painting, origin) {
  const name = painting.displayName || 'Anonymous';
  const title = `${painting.displayName || 'Someone'}’s Pulse Painting`;
  const description = 'A landscape made from a pulse. Explore this painting, then take three quiet minutes to make your own.';
  const appURL = `${origin}/?painting=${painting.id}#landscapes`;
  const esc = escapeHTML;
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title><link rel="canonical" href="${esc(painting.url)}"><meta name="description" content="${description}">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${description}"><meta property="og:url" content="${esc(painting.url)}">
<meta property="og:image" content="${esc(painting.imageURL)}"><meta property="og:image:width" content="1080"><meta property="og:image:height" content="1350"><meta property="og:image:alt" content="A community Pulse Painting">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${esc(painting.imageURL)}">
<style>
@font-face{font-family:DM;src:url(/fonts/dm-sans-latin.woff2) format('woff2');font-weight:100 900;font-display:swap}
@font-face{font-family:Brush;src:url(/fonts/water-brush-latin.woff2) format('woff2');font-display:swap}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 0 0,#5a87bb18,transparent 42%),radial-gradient(ellipse at 100% 45%,#7e69ad10,transparent 40%),#fdfbf7;color:#233b50;font:17px/1.6 DM,system-ui,sans-serif}
main{max-width:640px;margin:auto;padding:34px 24px 36px;text-align:center}.brand{margin:0 0 16px;font-size:14px;letter-spacing:.15em;text-transform:uppercase;color:#587080}h1{margin:0;font:400 clamp(48px,9vw,70px)/1.12 Brush,cursive;color:#192d3a}.byline{margin:14px auto 28px;color:#536a7b;overflow-wrap:anywhere}.byline strong{font-weight:550;color:#294c63}
figure{margin:0}img{display:block;width:100%;height:auto;border:1px solid #e3ded5;border-radius:3px;box-shadow:0 14px 42px #34466316}figcaption{margin:18px auto 28px;max-width:35ch;font-size:15px;color:#607585}
.invite{max-width:32ch;margin:0 auto 24px;font-size:22px;line-height:1.4;font-weight:500}.actions{display:flex;flex-direction:column;gap:10px}.button{display:flex;min-height:54px;align-items:center;justify-content:center;padding:13px 22px;border-radius:22px 25px 20px 24px;background:linear-gradient(115deg,#3156e5,#4d61c7 67%,#3d7caa);color:white;text-decoration:none;font-weight:600}.secondary{background:transparent;border:1px solid #d5dfe7;color:#315c8b;border-radius:26px}.footer{margin:26px 0 0;font-size:14px;color:#687986}a{color:inherit;text-underline-offset:3px}a:focus-visible{outline:3px solid #3156e5;outline-offset:5px}.gallery{display:inline-flex;align-items:center;min-height:44px;margin-top:10px;font-size:15px;color:#365c79}
@media(max-width:600px){main{padding:28px 22px calc(185px + env(safe-area-inset-bottom))}.actions{position:fixed;z-index:2;left:12px;right:12px;bottom:12px;gap:8px;padding:11px 11px max(11px,env(safe-area-inset-bottom));border:1px solid #d9e1e8;border-radius:30px;background:#fdfbf7f5;box-shadow:0 5px 30px #243a4a18}.button{min-height:48px}.byline{font-size:16px}figcaption{font-size:14px}}
</style></head><body><main>
<p class="brand">Pulse Painting</p><h1>A shared moment.</h1><p class="byline">Painted by a pulse. Shared by <strong>${esc(name)}</strong>.</p>
<figure><img src="${esc(painting.imageURL)}" width="1080" height="1350" alt="A pulse painting shared by ${esc(name)}"><figcaption>A little of someone’s world, for you to discover.</figcaption></figure>
<p class="invite">What would your pulse paint?</p><div class="actions"><a class="button" href="${origin}/">Make your own painting</a><a class="button secondary" href="${appURL}">Explore this painting</a></div>
<a class="gallery" href="${origin}/?collection=community#landscapes">Wander through the gallery ↗</a>
<p class="footer">A project by <a href="https://chatppg.com/">ChatPPG</a>. Powered by <a href="https://github.com/sontakey/ppg-js">ppg-js</a>.</p>
</main></body></html>`;
}
