import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendor = path.join(root, 'vendor/ppg-js/0.3.1');
const provenance = JSON.parse(await readFile(path.join(vendor, 'PROVENANCE.json'), 'utf8'));
const bundle = await readFile(path.join(vendor, 'ppg.global.js'));
const digest = createHash('sha256').update(bundle).digest('hex');
if (digest !== provenance.sha256 || bundle.length !== provenance.bytes) {
  throw new Error('The pinned ppg-js artifact does not match its provenance manifest.');
}

const dist = path.join(root, 'dist');
await rm(dist, { recursive: true, force: true });
await cp(path.join(root, 'app'), dist, { recursive: true });
await mkdir(path.join(dist, 'vendor'), { recursive: true });
for (const file of ['ppg.global.js', 'LICENSE', 'PROVENANCE.json']) {
  await cp(path.join(vendor, file), path.join(dist, 'vendor', file));
}
console.log(`Prepared static app with verified ppg-js ${provenance.version} (${digest.slice(0, 12)}).`);
