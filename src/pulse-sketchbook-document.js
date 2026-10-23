// Explicit adaptation of the preserved ThreeUI document. The original vendor
// source, Singapore plates and exact-source fixture remain unchanged.
import { createSketchbookDocument } from '../vendor/threeui-sketchbook/src/shaders/sketchbook/sketchbookDocument.js';

function replaceOnce(source, before, after, label) {
  if (!source.includes(before) || source.indexOf(before) !== source.lastIndexOf(before)) throw new Error(`The preserved Sketchbook source changed at ${label}.`);
  return source.replace(before, after);
}
const json = value => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');

export function createPulseSketchbookDocument(pages) {
  if (!Array.isArray(pages) || pages.length !== 3) throw new Error('Three prepared painting spreads are required.');
  const safePages = pages.map(page => {
    const url = String(page.url);
    if (url.length > 16 * 1024 * 1024 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(url)) throw new Error('Sketchbook spreads must be prepared PNG image data.');
    return { url, title: String(page.title).slice(0, 80), place: String(page.place || '').slice(0, 100) };
  });
  let source = createSketchbookDocument('/sketchbook/');
  // Retain only the original engine's required hidden anchors, not the
  // author's portfolio, portraits, biography, links or Singapore image nodes.
  source = source.replace('<title>Meng To</title>', '<title>Your pulse painting sketchbook</title>')
    .replace('content="designer, creator, AI educator — Singapore"', 'content="A personal sketchbook made from your finished pulse painting"')
    .replace(/<header class="top">[\s\S]*?<\/header>/, '')
    .replace(/<img class="botany [lr]"[^>]*>/g, '')
    .replace(/<p class="hero-kicker">[\s\S]*?<\/p>/, '')
    .replace(/<section id="about"[\s\S]*?<\/section>/, '<section id="about" hidden></section>')
    .replace(/<section id="plates"[\s\S]*?<\/section>/, '<section id="plates" hidden><ol id="plateList"></ol></section>')
    .replace(/<section id="contact"[\s\S]*?<\/section>/, '<section id="contact" hidden></section>')
    .replace('<p class="foot">Singapore · Sketchbook</p>', '')
    .replace('background:url(/sketchbook/bg-wash.jpg) center top / cover no-repeat;', 'background:radial-gradient(ellipse at 8% 20%,#d7e2de88,transparent 60%),radial-gradient(ellipse at 90% 90%,#d5cce333,transparent 60%),#f3eee3;')
    .replace('background:url(/sketchbook/divider.png) center / 100% auto no-repeat;', 'background:none;');
  const pageStart = source.indexOf("const DIR='/sketchbook/';");
  const pageEndMarker = 'PAGES.forEach(p=>p.url=DIR+p.file);';
  const pageEnd = source.indexOf(pageEndMarker, pageStart);
  if (pageStart < 0 || pageEnd < 0) throw new Error('The preserved Sketchbook page table changed.');
  source = `${source.slice(0, pageStart)}const PAGES=${json(safePages)};${source.slice(pageEnd + pageEndMarker.length)}`;
  source = replaceOnce(source, 'const M=PAGES.length, LAND=6;', 'const M=PAGES.length, LAND=0;', 'first personal spread');

  // Upstream stage capture swallowed clicks on its arrow buttons. Capture
  // only actual page gestures; preserve the original drag/curl calculation.
  source = replaceOnce(source,
    "  e.preventDefault();                     /* no text selection, no image drag */\n  const onBook=e.target.closest('.sb-zone');\n  stage.setPointerCapture(e.pointerId);\n  hideHint();\n  if(!onBook||introOn)return;",
    "  const onBook=e.target.closest('.sb-zone');\n  if(!onBook||introOn)return;\n  e.preventDefault();\n  stage.setPointerCapture(e.pointerId);\n  hideHint();",
    'page-only pointer capture');

  // Motion preference applies to this adapted experience in addition to the
  // original reduced-motion intro and page-commit behavior.
  source = replaceOnce(source, "  if(e.pointerType==='touch')return;", "  if(e.pointerType==='touch'||REDUCED)return;", 'reduced-motion hover tilt');
  source = replaceOnce(source, 'function cancel(){\n  if(!turn)return;', 'function cancel(){\n  if(!turn)return;\n  if(REDUCED){turn=null;paint();return;}', 'reduced-motion canceled turn');
  source = replaceOnce(source, '  viewActive=true;kick();\n  if(typeof syncZoom', '  if(REDUCED){view.rx=view.trx;view.ry=view.try_;view.z=view.tz;viewActive=false;applyView();}\n  else{viewActive=true;kick();}\n  if(typeof syncZoom', 'reduced-motion zoom');
  source = replaceOnce(source, 'function loupeEase(){\n  if(!lTarget)return false;', 'function loupeEase(){\n  if(!lTarget)return false;\n  if(REDUCED){lx=lTarget.x;ly=lTarget.y;lTarget=null;placeLoupe();return false;}', 'reduced-motion loupe');
  // The original treats failed images as loaded. A personal book must prove
  // every generated plate decoded before reporting readiness to its parent.
  source = replaceOnce(source,
    "  await Promise.all(PAGES.map(p=>{\n    const im=new Image();im.src=p.url;\n    return im.decode?im.decode().catch(()=>{}):new Promise(r=>{im.onload=im.onerror=r});\n  }));",
    "  try{await Promise.all(PAGES.map(async p=>{\n    const im=new Image();im.src=p.url;await im.decode();\n    if(im.naturalWidth!==1760||im.naturalHeight!==1240)throw new Error('Invalid painting spread');\n  }));}catch{parent.postMessage({type:'pulse-sketchbook-ready',ok:false},'*');return;}",
    'decoded personal plates');
  source = replaceOnce(source, "  document.body.dataset.ready='1';", "  document.body.dataset.ready='1';\n  parent.postMessage({type:'pulse-sketchbook-ready',ok:true},'*');", 'personal readiness');
  source = source.replace('Drag the page to turn · Drag the glass across it', 'Drag or tap the page to turn · Move the glass to look closer');
  const accessibleControls = `<style id="pulse-sketchbook-controls">
    #sketchbook .sb-3d{max-width:min(900px,92vw,calc((100svh - 148px) * 1.4193548))}
    @media(max-width:640px){#sketchbook .sb-3d{max-width:min(100vw,calc((100svh - 148px) * 1.4193548))}}
    .sb-caption{font-size:14px;letter-spacing:.06em;text-transform:none;color:#4b5a60}
    .sb-hint{font-size:14px;letter-spacing:0;text-transform:none;padding:0 14px;line-height:1.4;color:#4b5a60}
    .tool{width:44px;height:44px;color:#4b5a60}.tool svg{width:18px;height:18px}
    .zoom-read{font-size:14px;min-width:48px;color:#4b5a60}.sb-arrow{min-width:44px;min-height:44px;color:#4b5a60}
    .tool:focus-visible,.sb-arrow:focus-visible,.sb-zone:focus-visible{outline:2px solid #3158b6;outline-offset:2px}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
  </style>`;
  return source.replace('</head>', `${accessibleControls}</head>`);
}
