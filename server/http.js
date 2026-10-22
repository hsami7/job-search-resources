// Small HTTP helpers: JSON responses, bounded body reads, contained static files.
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'],
]);

export function httpError(status, message, extra = {}) {
  return Object.assign(new Error(message), { status, ...extra });
}

export function sendJson(res, status, body, headers = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(data),
    ...headers,
  });
  res.end(data);
}

export function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let over = false;
    let settled = false;
    const tooLarge = () => {
      if (settled) return;
      settled = true;
      reject(httpError(413, 'body_too_large'));
    };
    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > limit) {
        over = true;
        chunks.length = 0;
        // Stop buffering abuse; nothing legitimate sends 4x the limit.
        if (size > limit * 4) {
          tooLarge();
          req.destroy();
        }
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      if (over) {
        tooLarge();
        return;
      }
      settled = true;
      resolve(Buffer.concat(chunks));
    });
    req.on('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

export function serveStatic(res, root, urlPath) {
  const base = path.resolve(root);
  let relative;
  try {
    relative = decodeURIComponent(urlPath).replace(/^\/+/, '') || 'index.html';
  } catch {
    return sendJson(res, 400, { error: 'bad_path' });
  }
  const full = path.resolve(base, relative);
  if (full !== base && !full.startsWith(base + path.sep)) {
    return sendJson(res, 404, { error: 'not_found' });
  }
  let stat;
  try {
    stat = statSync(full);
  } catch {
    return sendJson(res, 404, { error: 'not_found' });
  }
  if (!stat.isFile()) return sendJson(res, 404, { error: 'not_found' });

  const ext = path.extname(full).toLowerCase();
  const headers = {
    'content-type': MIME.get(ext) ?? 'application/octet-stream',
    'cache-control': 'no-cache',
    'content-length': stat.size,
    'x-content-type-options': 'nosniff',
  };
  if (ext === '.html') {
    headers['content-security-policy'] =
      "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; img-src 'self' data:; " +
      "style-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'";
    headers['x-frame-options'] = 'DENY';
    headers['referrer-policy'] = 'no-referrer';
  }
  res.writeHead(200, headers);
  createReadStream(full).pipe(res);
}

export function sendFile(res, file, { filename, contentType } = {}) {
  const stat = statSize(file);
  if (!stat) return sendJson(res, 404, { error: 'not_found' });
  const name = String(filename ?? 'download').replace(/["\\\r\n]/g, '_');
  res.writeHead(200, {
    'content-type': contentType ?? 'application/octet-stream',
    'content-length': stat,
    'content-disposition': `inline; filename="${name}"`,
    'cache-control': 'private, max-age=60',
    'x-content-type-options': 'nosniff',
  });
  createReadStream(file).pipe(res);
}

function statSize(file) {
  try {
    const stat = statSync(file);
    return stat.isFile() ? stat.size : null;
  } catch {
    return null;
  }
}
