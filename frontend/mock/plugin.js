import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMockApi } from './api.js';
import { parseMultipart } from './multipart.js';

const assetsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets');

const MIME = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((item) => item.trim().split('='))
      .filter(([key]) => key)
      .map(([key, ...rest]) => [key, rest.join('=')]),
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function mockApiPlugin({ delay = 350 } = {}) {
  const api = createMockApi();

  return {
    name: 'photoshare-mock-api',
    configureServer(server) {
      server.middlewares.use('/mock', (req, res, next) => {
        const file = path.normalize(
          path.join(assetsDir, decodeURIComponent(req.url.split('?')[0])),
        );
        if (
          !file.startsWith(assetsDir + path.sep) ||
          !fs.existsSync(file) ||
          fs.statSync(file).isDirectory()
        ) {
          return next();
        }
        res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(file).pipe(res);
      });

      server.middlewares.use('/api', async (req, res) => {
        const url = new URL(req.url, 'http://mock.local');
        const raw = await readBody(req);
        const contentType = req.headers['content-type'] || '';

        let body;
        let form;
        if (contentType.includes('multipart/form-data')) {
          form = parseMultipart(raw, contentType);
        } else if (raw.length > 0) {
          try {
            body = JSON.parse(raw.toString('utf8'));
          } catch {
            body = undefined;
          }
        }

        if (delay > 0) await sleep(delay);

        const result = await api.handle({
          method: req.method,
          path: url.pathname,
          query: url.searchParams,
          cookies: parseCookies(req.headers.cookie),
          body,
          form,
          origin: `http://${req.headers.host}`,
        });

        res.statusCode = result.status;
        if (result.setCookie) res.setHeader('Set-Cookie', result.setCookie);
        if (result.body === undefined) {
          res.end();
          return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(result.body));
      });

      server.config.logger.info(
        '\n  Мок-API увімкнено: /api (дані в пам\u2019яті, скидання: POST /api/dev/reset)\n',
      );
    },
  };
}
