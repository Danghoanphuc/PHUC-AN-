import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};
http
  .createServer((req, res) => {
    const path = resolve(
      root,
      '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname),
    );
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const file = existsSync(path) && statSync(path).isFile() ? path : resolve(root, 'index.html');
    res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
    res.end(readFileSync(file));
  })
  .listen(8081, '127.0.0.1', () => console.log('Preview at http://127.0.0.1:8081'));
