import { createServer as createHttpServer, Server as HttpServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, expect, it } from 'vitest';
import { createServer, ViteDevServer } from 'vite';
import config from './vite.config';

let frontend: ViteDevServer | undefined;
let backend: HttpServer | undefined;

afterEach(async () => {
  await frontend?.close();
  if (backend) await new Promise<void>((resolve, reject) => backend!.close(error => error ? reject(error) : resolve()));
});

it('serves the API Keys page directly while proxying API requests to the backend', async () => {
  backend = createHttpServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ receivedPath: request.url }));
  });
  await new Promise<void>(resolve => backend!.listen(0, '127.0.0.1', resolve));
  const backendPort = (backend.address() as AddressInfo).port;
  const configuredProxy = config.server!.proxy!;
  const proxy = Object.fromEntries(Object.entries(configuredProxy).map(([path, options]) => [
    path, { ...(typeof options === 'string' ? {} : options), target: `http://127.0.0.1:${backendPort}` },
  ]));
  frontend = await createServer({
    ...config,
    configFile: false,
    server: { ...config.server, host: '127.0.0.1', port: 0, proxy },
  });
  await frontend.listen();
  const port = (frontend.httpServer!.address() as AddressInfo).port;
  const page = await fetch(`http://127.0.0.1:${port}/api-keys`);
  expect(page.headers.get('content-type')).toContain('text/html');
  expect(await page.text()).toContain('<div id="root"></div>');
  const health = await fetch(`http://127.0.0.1:${port}/api/health`);
  expect(await health.json()).toEqual({ receivedPath: '/health' });
}, 15000);
