import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, normalize, join} from 'node:path';
import {fileURLToPath} from 'node:url';
// Serves dist/ at the public /unbound/ mount, matching krois.dk. Run npm run build first.
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT || 8080);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webp':'image/webp','.avif':'image/avif','.jpeg':'image/jpeg','.jpg':'image/jpeg','.mp4':'video/mp4','.webm':'video/webm'};
createServer(async (request, response) => {
  const {pathname} = new URL(request.url, 'http://localhost');
  if (!pathname.startsWith('/unbound')) { response.writeHead(302, {location: '/unbound/'}); return response.end(); }
  let file = join(dist, normalize(decodeURIComponent(pathname.slice('/unbound'.length))).replace(/^([/\\])+/, ''));
  if (!file.startsWith(dist.replace(/[/\\]$/, ''))) { response.writeHead(403); return response.end(); }
  try {
    const info = await stat(file);
    if (info.isDirectory()) {
      if (!pathname.endsWith('/')) { response.writeHead(301, {location: `${pathname}/`}); return response.end(); }
      file = join(file, 'index.html');
    }
    const body = await readFile(file);
    const headers = {'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store'};
    const range = /bytes=(\d*)-(\d*)/.exec(request.headers.range || '');
    if (range) {
      const start = Number(range[1] || 0), end = range[2] ? Number(range[2]) : body.length - 1;
      response.writeHead(206, {...headers, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${body.length}`, 'content-length': end - start + 1});
      return response.end(body.subarray(start, end + 1));
    }
    response.writeHead(200, {...headers, 'accept-ranges': 'bytes', 'content-length': body.length});
    response.end(body);
  } catch {
    response.writeHead(404, {'content-type': 'text/plain'});
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Previewing dist/ at http://127.0.0.1:${port}/unbound/`));
