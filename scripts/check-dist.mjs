import { readFile, readdir, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('dist');
// Astro's prerender bundle is a build intermediate, not a public site asset.
await rm(resolve(root, '.prerender'), { recursive: true, force: true });
const required = ['index.html', 'login/index.html', 'manifest.webmanifest', 'sw.js', 'offline.html', '.htaccess'];
for (const name of required) await stat(resolve(root, name));

const files = await readdir(root, { recursive: true });
for (const name of files) {
  if (/\.map$|(?:^|\/)\.env(?:\.|$)/.test(name)) throw new Error(`Fichier non public dans dist : ${name}`);
  if (!/\.(html|js|css)$/.test(name)) continue;
  const text = await readFile(resolve(root, name), 'utf8');
  if (/\/api\/studio|\/api\/auth\/login|SESSION_SECRET|PHOTO_PASSWORD/.test(text)) {
    throw new Error(`Ancienne dépendance au serveur dans ${name}`);
  }
  for (const match of text.matchAll(/(?:href|src|component-url|renderer-url)="(\/[^"?#]*)/g)) {
    const path = match[1];
    await stat(resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path)));
  }
}
const assets = await readdir(resolve(root, '_astro'));
if (!assets.some(name => /^photos-.*\.js$/.test(name))) throw new Error('Web Worker de photothèque manquant.');
console.log('dist vérifié : pages, ressources et Web Worker prêts pour un hébergement statique.');
