// Personal book plates for the separately adapted ThreeUI renderer. Artwork
// pixels come only from the prepared share image; paper and type are framing.
const W = 1760, H = 1240;
const PAPER = { x: 89.76, y: 270.32, w: 1580.48, h: 699.36 };
const INK = '#294556', MUTED = '#637d85';
export const PERSONAL_BOOK_PORTRAIT = Object.freeze({ x: 256, y: 326, w: 460, h: 575 });

function check(signal) {
  if (signal?.aborted) throw new DOMException('The sketchbook was closed.', 'AbortError');
}
function encode(canvas) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The sketchbook took too long to prepare.')), 30000);
    canvas.toBlob(blob => {
      clearTimeout(timer);
      if (blob) resolve(blob); else reject(new Error('The paper could not be prepared.'));
    }, 'image/png');
  });
}
function grain() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 192;
  const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(192, 192);
  let seed = 72031;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const dark = seed & 1;
    pixels.data[i] = dark ? 103 : 255;
    pixels.data[i + 1] = dark ? 101 : 255;
    pixels.data[i + 2] = dark ? 89 : 255;
    pixels.data[i + 3] = 3 + (seed >>> 28);
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}
function outline(ctx, offset = 0) {
  const { x, y, w, h } = PAPER;
  ctx.beginPath();
  ctx.moveTo(x + 42, y + offset);
  ctx.bezierCurveTo(x + 220, y - 4 + offset, 790, y - 3 + offset, 880, y + 4 + offset);
  ctx.bezierCurveTo(950, y - 2 + offset, x + w - 110, y + 2 + offset, x + w - 40, y + 1 + offset);
  ctx.quadraticCurveTo(x + w, y + offset, x + w, y + 42 + offset);
  ctx.lineTo(x + w + 1, y + h - 39 + offset);
  ctx.quadraticCurveTo(x + w + 1, y + h + offset, x + w - 38, y + h + offset);
  ctx.bezierCurveTo(1380, y + h - 2 + offset, 970, y + h - 1 + offset, 880, y + h - 3 + offset);
  ctx.bezierCurveTo(790, y + h + 4 + offset, 250, y + h + 1 + offset, x + 41, y + h - 1 + offset);
  ctx.quadraticCurveTo(x, y + h - 2 + offset, x, y + h - 42 + offset);
  ctx.lineTo(x, y + 41 + offset);
  ctx.quadraticCurveTo(x, y + offset, x + 42, y + offset);
  ctx.closePath();
}
function paper(ctx, texture) {
  ctx.save();
  for (const offset of [8, 4, 0]) {
    outline(ctx, offset); ctx.fillStyle = offset ? '#e5e0d4' : '#fcfaf4'; ctx.fill();
    ctx.strokeStyle = '#c7c2b72b'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  outline(ctx); ctx.clip();
  const warmth = ctx.createLinearGradient(0, PAPER.y, 0, PAPER.y + PAPER.h);
  warmth.addColorStop(0, '#ffffff33'); warmth.addColorStop(1, '#b9ab9012');
  ctx.fillStyle = warmth; ctx.fillRect(PAPER.x, PAPER.y, PAPER.w, PAPER.h);
  ctx.fillStyle = ctx.createPattern(texture, 'repeat'); ctx.fillRect(PAPER.x, PAPER.y, PAPER.w, PAPER.h);
  const fold = ctx.createLinearGradient(847, 0, 912, 0);
  fold.addColorStop(0, '#8a7e6600'); fold.addColorStop(.46, '#6a604c1d');
  fold.addColorStop(.51, '#fffef3aa'); fold.addColorStop(.57, '#ffffff00'); fold.addColorStop(1, '#8a7e6600');
  ctx.fillStyle = fold; ctx.fillRect(847, PAPER.y, 65, PAPER.h);
  ctx.restore();
}
function text(ctx, value, x, y, { size = 30, color = INK, serif = false, width = 600, weight = 400 } = {}) {
  ctx.font = `${weight} ${size}px ${serif ? 'Georgia, serif' : '"DM Sans", sans-serif'}`;
  ctx.fillStyle = color; ctx.fillText(value, x, y, width);
}
function footer(ctx, index, label) {
  text(ctx, label, 150, 934, { size: 22, color: MUTED, width: 610 });
  ctx.textAlign = 'right'; text(ctx, `0${index} / 03`, 1608, 934, { size: 22, color: MUTED, width: 160 });
  ctx.textAlign = 'left';
}
function portrait(ctx, source, rect = PERSONAL_BOOK_PORTRAIT) {
  const scale = Math.min(rect.w / source.width, rect.h / source.height);
  const width = source.width * scale, height = source.height * scale;
  const x = rect.x + (rect.w - width) / 2, y = rect.y + (rect.h - height) / 2;
  ctx.save(); ctx.shadowColor = '#28485718'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#fdfbf7'; ctx.fillRect(x, y, width, height); ctx.restore();
  ctx.drawImage(source, x, y, width, height);
}
async function decode(blob) {
  if (!(blob instanceof Blob) || !['image/png', 'image/jpeg', 'image/webp'].includes(blob.type) || !blob.size || blob.size > 12 * 1024 * 1024) throw new Error('A finished painting is needed to open the sketchbook.');
  const url = URL.createObjectURL(blob), image = new Image();
  try {
    image.src = url; await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 16_000_000) throw new Error('This painting is too large for the sketchbook.');
    return image;
  } finally { URL.revokeObjectURL(url); }
}
export async function createPulseSketchbookSpreads(blob, { signal } = {}) {
  check(signal);
  const source = await decode(blob); check(signal);
  if (document.fonts?.ready) await document.fonts.ready;
  check(signal);
  const texture = grain(), pages = [], urls = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return; disposed = true;
    for (const url of urls) URL.revokeObjectURL(url);
    texture.width = texture.height = 0;
    source.removeAttribute('src');
  };
  try {
    for (let index = 0; index < 3; index++) {
      check(signal);
      const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d'); paper(ctx, texture);
      let title, place;
      if (index === 0) {
        title = 'Your painting'; place = 'The complete artwork';
        portrait(ctx, source);
        text(ctx, 'A PLACE ONLY', 978, 414, { size: 23, color: MUTED });
        text(ctx, 'YOUR PULSE COULD PAINT.', 978, 451, { size: 23, color: MUTED });
        text(ctx, 'A little world,', 978, 554, { size: 58, serif: true });
        text(ctx, 'made by you.', 978, 628, { size: 58, serif: true });
        text(ctx, 'Every mark begins with your pulse.', 978, 722, { size: 27 });
        text(ctx, 'Turn the page. Look a little closer.', 978, 768, { size: 27, color: MUTED });
        footer(ctx, 1, 'Your complete painting · nothing cropped');
      } else if (index === 1) {
        title = 'A closer look'; place = 'Details from the same painting';
        // This square lies inside both legacy and keepsake 4:5 artwork bounds.
        // Keep their names, measurements and other card text out of details.
        // Other aspect ratios use a central detail; no new marks are generated.
        const known = Math.abs(source.width / source.height - .8) < .005;
        const region = known ? { x: source.width * 100 / 1080, y: source.height * 190 / 1350, w: source.width * 880 / 1080, h: source.height * 880 / 1350 }
          : { x: 0, y: 0, w: source.width, h: source.height };
        const size = Math.min(region.w, region.h) * .62;
        const cropHeight = size * 440 / 600;
        for (let side = 0; side < 2; side++) {
          const sx = region.x + (region.w - size) * (side ? .78 : .18);
          const sy = region.y + (region.h - cropHeight) * (side ? .92 : .38);
          const dx = side ? 974 : 184;
          text(ctx, side ? 'The small things.' : 'Follow the pulse.', dx, 360, { size: 35, serif: true });
          ctx.drawImage(source, sx, sy, size, cropHeight, dx, 402, 600, 440);
          text(ctx, side ? 'A second detail of your painting' : 'A detail of your painting', dx, 887, { size: 24, color: MUTED });
        }
        footer(ctx, 2, 'Details of the same artwork');
      } else {
        title = 'A moment to share'; place = 'Your painting is ready to travel';
        portrait(ctx, source);
        text(ctx, 'KEEP A LITTLE.', 978, 422, { size: 23, color: MUTED });
        text(ctx, 'SHARE A LITTLE.', 978, 459, { size: 23, color: MUTED });
        text(ctx, 'Let it travel.', 978, 580, { size: 64, serif: true });
        text(ctx, 'Send your painting to someone', 978, 680, { size: 28 });
        text(ctx, 'who could use a quiet moment.', 978, 725, { size: 28 });
        text(ctx, 'pulsepainting.com', 978, 821, { size: 30, color: '#2854ae', weight: 500 });
        footer(ctx, 3, 'Pulse Painting · a project by ChatPPG');
      }
      let encoded;
      try { encoded = await encode(canvas); }
      finally { canvas.width = canvas.height = 0; }
      check(signal);
      const url = URL.createObjectURL(encoded); urls.push(url); pages.push({ url, title, place });
    }
    texture.width = texture.height = 0; source.removeAttribute('src');
    return { pages, dispose };
  } catch (error) { dispose(); throw error; }
}
