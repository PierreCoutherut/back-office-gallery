import { test, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname, relative, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const temp = mkdtempSync(resolve('.test-build-'));
function compile(path) {
  const input = resolve('src', path), output = resolve(temp, path.replace(/\.tsx?$/, '.js'));
  if (!compiled.has(input)) {
    compiled.add(input);
    let code = ts.transpileModule(readFileSync(input, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    code = code.replace(/from (['"])(\.[^'"]+)\1/g, (all, quote, specifier) => {
      const base = resolve(dirname(input), specifier);
      const children = readdirSync(dirname(base));
      const name = basename(base);
      const extension = children.includes(name + '.tsx') ? '.tsx' : '.ts';
      compile(relative(resolve('src'), base + extension));
      return `from ${quote}${specifier}.js${quote}`;
    });
    mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, code);
  }
  return pathToFileURL(output).href;
}
const compiled = new Set();
const data = await import(compile('lib/data.ts'));
const completion = await import(compile('lib/gallery-completion.ts'));
const session = await import(compile('lib/session.ts'));
const client = await import(compile('lib/api.ts'));
const { JsonArrayStream } = await import(compile('lib/json-array-stream.ts'));
const { default: GalleryCompletion } = await import(compile('components/GalleryCompletion.tsx'));
after(() => rmSync(temp, { recursive: true, force: true }));

const cover = { id: 'photo-cover', name: 'Vignette', urls: { small: 'https://photos.example/thumb.webp' } };
const complete = { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', name: 'Galerie', tags: ['Outdoor'], status: 'public', featuredPhoto: cover };
const originalFetch = globalThis.fetch;
const storage = new Map();
let redirects = [];
beforeEach(() => {
  storage.clear(); redirects = [];
  globalThis.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  globalThis.location = { hash: '#a-completer', replace: value => redirects.push(value) };
});
afterEach(() => { globalThis.fetch = originalFetch; });
after(() => { delete globalThis.sessionStorage; delete globalThis.location; });

test('private galleries and subgalleries without a password are incomplete', () => {
  for (const parentId of [undefined, 'parent']) {
    const gallery = data.normalizeGallery({ ...complete, status: 'private', password: '  ', parentId });
    assert.deepEqual(completion.missingGalleryFields(gallery), ['Mot de passe']);
    assert.deepEqual(completion.missingGalleryFields({ ...gallery, hasPassword: true }), []);
    assert.deepEqual(completion.missingGalleryFields({ ...gallery, status: 'public' }), []);
    assert.deepEqual(completion.missingGalleryFields({ ...gallery, status: 'non-reference' }), []);
  }
});

test('root tags remain required; subgallery tags and dates are optional', () => {
  assert.deepEqual(completion.missingGalleryFields({ ...complete, tags: [] }), ['Tags']);
  assert.deepEqual(completion.missingGalleryFields({ ...complete, tags: [], parentId: 'parent' }), []);
  assert.deepEqual(completion.missingGalleryFields({ status: 'unknown', parentId: 'parent', tags: [] }), ['Vignette', 'Statut']);
  assert.deepEqual(completion.missingGalleryFields({ ...complete, featuredPhoto: { id: 'broken' } }), ['Vignette']);
});

test('normalization removes actual passwords and preserves missing versus unknown password state', () => {
  const value = data.normalizeGallery({ ...complete, password: 'test-only-secret', subGalleries: [{ id: 'child', name: 'Enfant', password: null }] });
  assert.equal(value.hasPassword, true);
  assert.equal(value.subGalleries[0].hasPassword, false);
  assert.equal(value.subGalleries[0].parentId, complete.id);
  assert.equal(JSON.stringify(value).includes('test-only-secret'), false);
  assert.equal(Object.hasOwn(value, 'password'), false);
  assert.equal(data.normalizeGallery(complete).hasPassword, undefined);
  assert.equal(data.normalizeGallery({ ...complete, hasPassword: true }).hasPassword, true);
  const photo = data.normalizePhoto({ id: 'photo', galleries: [{ id: 'gallery', name: 'Nom', password: 'test-only-secret' }] });
  assert.equal(JSON.stringify(photo).includes('password'), false);
});

test('nested and flat galleries produce one row per gallery and preserve ancestry', () => {
  const rows = data.normalizeGalleryList([{ ...complete, subGalleries: [{ id: 'child', name: 'Enfant', password: null }] }, { id: 'child', name: 'Enfant', parentGallery: { id: complete.id } }]);
  assert.equal(rows.length, 2); assert.equal(rows[1].parentId, complete.id); assert.equal(rows[1].hasPassword, false);
});

test('completion rows render the password field and the specific warning', () => {
  const gallery = { ...complete, status: 'private', hasPassword: false, parentId: 'parent', tags: [] };
  const html = renderToStaticMarkup(React.createElement(GalleryCompletion, { galleries: [gallery], allGalleries: [gallery], loadGallery: async () => gallery, onSave: async () => {}, onOpen: () => {} }));
  assert.ok(html.includes('Privée · mot de passe manquant'));
  assert.ok(html.includes('type="password"')); assert.ok(html.toLowerCase().includes('autocomplete="new-password"'));
  assert.ok(html.includes('Tags (facultatifs)')); assert.ok(!html.includes('Tags à compléter'));
});

test('session survives refresh in the tab and expires at the API token deadline', () => {
  const exp = Math.floor(Date.now() / 1000) + 60;
  const token = 'header.' + Buffer.from(JSON.stringify({ exp })).toString('base64url') + '.signature';
  session.saveSession(token, 'test-user');
  assert.equal(session.getSession().expiresAt, exp * 1000);
  assert.equal(session.getSession().accessToken, token);
  const value = JSON.parse(storage.get(session.SESSION_KEY)); value.expiresAt = Date.now() - 1;
  storage.set(session.SESSION_KEY, JSON.stringify(value));
  assert.equal(session.getSession(), null); assert.equal(storage.has(session.SESSION_KEY), false);
  assert.throws(() => session.saveSession('header.' + Buffer.from('{"exp":1}').toString('base64url') + '.signature', 'test-user'));
});

test('login calls the existing API and stores the token but never the password', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, client.API_BASE + '/auth/login'); assert.equal(options.credentials, 'omit');
    assert.deepEqual(JSON.parse(options.body), { username: 'test-user', password: 'test-only-password' });
    return Response.json({ access_token: 'opaque-test-token' });
  };
  await client.login('test-user', 'test-only-password');
  assert.equal(session.getSession().username, 'test-user');
  assert.equal(JSON.stringify([...storage]).includes('test-only-password'), false);
  session.clearSession(); globalThis.fetch = async () => new Response(null, { status: 401 });
  await assert.rejects(client.login('test-user', 'wrong'), /incorrect/); assert.equal(session.getSession(), null);
});

test('API calls require a session, attach its token and normalize private galleries', async () => {
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++; assert.equal(options.headers.get('Authorization'), 'Bearer opaque-test-token');
    return Response.json([{ ...complete, status: 'private', password: null }]);
  };
  await assert.rejects(client.api('/gallery'), /session/); assert.equal(calls, 0);
  session.saveSession('opaque-test-token', 'test-user');
  const result = await client.api('/gallery'); assert.equal(calls, 1); assert.equal(result[0].hasPassword, false);
});

test('password edits are explicit; gallery deletion preserves photos; bulk wipes are blocked', async () => {
  session.saveSession('opaque-test-token', 'test-user'); let seen;
  globalThis.fetch = async (url, options) => { seen = { url, options }; return new Response(null, { status: 204 }); };
  await client.api('/gallery/' + complete.id, 'PATCH', { password: 'new-test-password' });
  assert.deepEqual(JSON.parse(seen.options.body), { password: 'new-test-password' });
  await client.api('/gallery/' + complete.id, 'DELETE'); assert.ok(seen.url.endsWith('?deletePhotos=false'));
  assert.throws(() => client.apiURL('/gallery', 'DELETE')); assert.throws(() => client.apiURL('/photos', 'POST'));
  assert.throws(() => client.apiURL('https://outside.example/gallery'));
  assert.throws(() => client.apiURL('/gallery/../../auth/login'));
});

test('expired API auth clears the session and preserves the current view for login', async () => {
  session.saveSession('opaque-test-token', 'test-user');
  globalThis.fetch = async () => new Response(null, { status: 401 });
  await assert.rejects(client.api('/gallery'), /expiré/);
  assert.equal(session.getSession(), null); assert.equal(storage.get('studio-return-hash'), '#a-completer');
  assert.deepEqual(redirects, ['/login/']); session.returnToStudio(); assert.equal(redirects.at(-1), '/#a-completer');
  storage.set('studio-return-hash', '//outside.example'); session.returnToStudio(); assert.equal(redirects.at(-1), '/#galeries');
});

test('stream parser handles arbitrary chunk boundaries, strings, Unicode and nested objects', () => {
  const input = [{ id: '1', name: 'Un {nom} avec "guillemets" et \\ slash 🏔', galleries: [{ id: 'g', tags: ['été'] }] }, { id: '2' }];
  const json = JSON.stringify(input);
  for (const chunkSize of [1, 2, 7, 41, json.length]) {
    const result = [], parser = new JsonArrayStream(value => result.push(value));
    for (let i = 0; i < json.length; i += chunkSize) parser.push(json.slice(i, i + chunkSize));
    parser.finish(); assert.deepEqual(result, input);
  }
  for (const input of ['[{"id":"unfinished', '[{},]', '[{} {}]', '{"error":"not an array"}', '[{}]garbage']) {
    assert.throws(() => { const parser = new JsonArrayStream(() => {}); parser.push(input); parser.finish(); });
  }
});

test('large index is emitted incrementally, without waiting for the closing array', () => {
  let count = 0; const parser = new JsonArrayStream(() => count++);
  parser.push('[');
  for (let i = 0; i < 30000; i++) parser.push((i ? ',' : '') + JSON.stringify({ id: String(i), tags: ['photo'] }));
  assert.equal(count, 30000); parser.push(']'); parser.finish();
});
