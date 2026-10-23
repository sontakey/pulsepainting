import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const port = Number(process.env.PORT || 5173);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const apiRoutes = {
  '/api/paintings': '../api/paintings.js',
  '/api/painting-report': '../api/painting-report.js',
  '/api/painting-page': '../api/painting-page.js',
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let name = decodeURIComponent(url.pathname);
    const painting = name.match(/^\/(p|book)\/([a-f0-9-]+)$/i);
    const api = apiRoutes[name] || (painting ? apiRoutes['/api/painting-page'] : null);
    if (api) {
      req.query = Object.fromEntries(url.searchParams);
      if (painting) { req.query.id = painting[2]; if (painting[1] === 'book') req.query.view = 'book'; }
      res.status = code => { res.statusCode = code; return res; };
      res.json = body => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
      const {default: handler} = await import(api);
      await handler(req, res);
      return;
    }
    name = name.replace(/^\/pulse-painting(?=\/|$)/, '') || '/';
    if (name.endsWith('/')) name += 'index.html';
    const file = path.resolve(root, '.' + name);
    if (!file.startsWith(root + path.sep) || !(await stat(file)).isFile()) throw new Error('not found');
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', ...(name.startsWith('/sketchbook/') ? { 'Access-Control-Allow-Origin': '*' } : {}) });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Pulse Painting: http://127.0.0.1:${port}`));
