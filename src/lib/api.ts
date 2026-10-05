import { normalizeGallery, normalizeGalleryList, normalizePhoto } from './data';
import { requireSession, expireSession, saveSession } from './session';

export const API_BASE = 'https://api.pierre-coutherut.fr';
const allowed = /^\/(gallery(?:\/[a-f0-9-]{36}(?:\/photos|\/notify-client)?)?|photos(?:\/[a-f0-9-]{36}|\/upload)?)$/;

export function apiURL(path: string, method = 'GET'): string {
  if (!allowed.test(path) || !['GET', 'POST', 'PATCH', 'DELETE'].includes(method)
    || (path === '/photos' && method !== 'GET') || (path === '/gallery' && method === 'DELETE')) {
    throw new Error('Action indisponible.');
  }
  // Deleting a gallery must preserve the original photos.
  const query = method === 'DELETE' && /^\/gallery\/[a-f0-9-]{36}$/.test(path) ? '?deletePhotos=false' : '';
  return API_BASE + path + query;
}

export async function responseError(response: Response): Promise<Error> {
  let message = '';
  try {
    const value = await response.json();
    message = Array.isArray(value.message) ? value.message.join(', ') : value.message || value.error || '';
  } catch {}
  return new Error(message || `L’API a refusé cette action (${response.status}).`);
}

export async function login(username: string, password: string): Promise<void> {
  const response = await fetch(API_BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'omit', cache: 'no-store', redirect: 'error',
    body: JSON.stringify({ username, password }), signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403
    ? 'Identifiant ou mot de passe incorrect.' : 'Connexion indisponible. Réessayez dans quelques instants.');
  const value = await response.json();
  if (typeof value.access_token !== 'string' || !value.access_token) throw new Error('La session API est indisponible.');
  saveSession(value.access_token, username);
}

export async function api(path: string, method = 'GET', body?: unknown): Promise<any> {
  const url = apiURL(path, method), session = requireSession();
  const headers = new Headers({ Authorization: 'Bearer ' + session.accessToken });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(45000),
  });
  if (response.status === 401) { expireSession(); throw new Error('Votre session a expiré.'); }
  if (!response.ok) throw await responseError(response);
  if (response.status === 204) return { ok: true };
  const text = await response.text(), value = text ? JSON.parse(text) : { ok: true };
  if (method !== 'GET') return { ok: true, id: value?.id };
  return path === '/gallery' ? normalizeGalleryList(value)
    : path.startsWith('/gallery/') ? normalizeGallery(value) : normalizePhoto(value);
}
