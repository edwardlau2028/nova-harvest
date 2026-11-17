// Serves game/ on localhost:8080 for play-testing. Static files only, no build step:
//   node serve.ts
// then open http://localhost:8080 in a desktop browser. Add ?shot=start|play|nova|end
// (with &seed=N) to stage a screenshot scene instead of the live game.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, 'game');
const port = 8080;

const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
]);

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = join(root, decodeURIComponent(path));
    if (!file.startsWith(root)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    const data = await readFile(file);
    response.writeHead(200, { 'content-type': types.get(extname(file)) ?? 'application/octet-stream' });
    response.end(data);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

server.listen(port, () => {
  console.log(`Nova Harvest at http://localhost:${port}`);
});
