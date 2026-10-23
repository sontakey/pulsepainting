import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANONICAL_SKETCHBOOK_HTML, createSketchbookDocument } from '../vendor/threeui-sketchbook/src/shaders/sketchbook/sketchbookDocument.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendor = path.join(root, 'vendor/threeui-sketchbook');
const manifest = JSON.parse(await readFile(path.join(vendor, 'PROVENANCE.json'), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function verify(file, entry) {
  const bytes = await readFile(file);
  assert.equal(bytes.length, entry.bytes, `${entry.path}: byte count changed`);
  assert.equal(sha(bytes), entry.sha256, `${entry.path}: authored content changed`);
}
await Promise.all(manifest.files.map(entry => verify(path.join(vendor, entry.path), entry)));
await Promise.all(manifest.assets.map(entry => verify(path.join(root, 'app/sketchbook', path.basename(entry.path)), entry)));
await Promise.all(manifest.notices.flatMap(entry => [
  verify(path.join(vendor, entry.path), entry),
  verify(path.join(root, 'app/sketchbook', entry.path), entry),
]));
assert.equal(sha(CANONICAL_SKETCHBOOK_HTML), manifest.canonicalHtmlSha256, 'canonical authored HTML changed');
const document = createSketchbookDocument('/sketchbook/');
assert.ok(document.includes('id="threeui-sketchbook-host"'));
assert.ok(document.includes("const DIR='/sketchbook/'"));
for (const plate of ['marina-bay-sands', 'gardens-by-the-bay', 'merlion', 'buddha-tooth', 'joo-chiat', 'lau-pa-sat', 'marina-bay-skyline', 'singapore-river', 'botanic-gardens']) {
  assert.ok(document.includes(`file:'${plate}.png'`), `${plate}: authored spread missing`);
}
assert.ok(document.includes('sandbox') === false, 'sandbox belongs to the unchanged React component');
console.log(`Verified exact ThreeUI Sketchbook: ${manifest.files.length} source files, ${manifest.assets.length} assets, complete authored document and MIT/OFL notices.`);
