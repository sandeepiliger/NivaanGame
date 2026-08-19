/**
 * Zero-dependency static server for local development.
 *
 *   npm start            → http://localhost:5173
 *   PORT=8080 npm start
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { networkInterfaces } from 'node:os';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const PORT = Number(process.env.PORT || 5173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';

    const filePath = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    const info = await stat(filePath).catch(() => null);
    if (!info || info.isDirectory()) {
      // Single-page app: unknown paths fall back to the shell.
      const shell = await readFile(join(ROOT, 'index.html'));
      res.writeHead(200, { 'content-type': TYPES['.html'] }).end(shell);
      return;
    }

    const body = await readFile(filePath);
    res
      .writeHead(200, {
        'content-type': TYPES[extname(filePath)] || 'application/octet-stream',
        'cache-control': 'no-cache',
      })
      .end(body);
  } catch (err) {
    res.writeHead(500).end(String(err));
  }
});

server.listen(PORT, () => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .find((i) => i && i.family === 'IPv4' && !i.internal);
  console.log(`\n  Nivaan Learning Games`);
  console.log(`  ➜  Local:   http://localhost:${PORT}`);
  if (lan) console.log(`  ➜  Network: http://${lan.address}:${PORT}   (open this on your phone)`);
  console.log('');
});
