import { createHash } from 'node:crypto';
import { copyFile, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const dist = new URL('../dist/', import.meta.url);

async function codeAssets(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? codeAssets(path) : [path];
    }),
  );
  return files.flat();
}

const assets = (await codeAssets(new URL('assets/', dist).pathname))
  .filter((path) => /\.(js|css)$/.test(path))
  .map((path) => relative(dist.pathname, path).split(sep).join('/'))
  .sort();
const shell = [
  'index.html',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  ...assets,
];
const hash = createHash('sha256');
for (const asset of shell) {
  hash.update(asset);
  hash.update(await readFile(new URL(asset, dist)));
}
const version = hash.digest('hex').slice(0, 12);

const worker = `const SHELL = 'kaogong-shell-${version}';
const CONTENT = 'kaogong-content-v1';
const SCOPE = self.registration.scope;
const FILES = ${JSON.stringify(shell)}.map((path) => new URL(path, SCOPE).href);
const INDEX = new URL('index.html', SCOPE).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(FILES)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys
      .filter((key) => key.startsWith('kaogong-shell-') && key !== SHELL)
      .map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) return response;
  } catch { /* Use the installed shell while offline. */ }
  return (await caches.match(INDEX)) || Response.error();
}

async function cacheContent(request) {
  const cache = await caches.open(CONTENT);
  const cached = await cache.match(request, { ignoreVary: true });
  const isJson = new URL(request.url).pathname.endsWith('.json');
  if (cached && !isJson) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      const keys = await cache.keys();
      if (keys.length > 120) await cache.delete(keys[0]);
    }
    return response;
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  } else if (url.pathname.includes('/content/')) {
    event.respondWith(cacheContent(request));
  } else {
    event.respondWith(caches.match(request, { ignoreVary: true }).then((cached) => cached || fetch(request)));
  }
});
`;

await writeFile(new URL('sw.js', dist), worker);
await copyFile(new URL('index.html', dist), new URL('404.html', dist));
console.log(`PWA shell: ${shell.length} files, version ${version}`);
