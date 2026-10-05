export const SESSION_KEY = 'pierre-studio-session-v2';
const MAX_SESSION_MS = 8 * 60 * 60 * 1000;
export type Session = { accessToken: string; username: string; expiresAt: number };

export function tokenExpiry(token: string, now = Date.now()): number {
  try {
    const part = token.split('.')[1];
    const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) {
      return Math.min(payload.exp * 1000, now + MAX_SESSION_MS);
    }
  } catch { /* Opaque access tokens use a bounded local session. */ }
  return now + MAX_SESSION_MS;
}

export function getSession(): Session | null {
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (typeof session?.accessToken === 'string' && session.accessToken.length > 0
      && typeof session.username === 'string' && Number.isFinite(session.expiresAt)
      && session.expiresAt > Date.now()) return session;
    sessionStorage.removeItem(SESSION_KEY);
  } catch { /* Storage may be unavailable in restricted browser contexts. */ }
  return null;
}

export function saveSession(accessToken: string, username: string): void {
  const expiresAt = tokenExpiry(accessToken);
  if (expiresAt <= Date.now()) throw new Error('La session reçue a expiré. Reconnectez-vous.');
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken, username, expiresAt })); }
  catch { throw new Error('Autorisez le stockage de session dans votre navigateur pour vous connecter.'); }
}

export function clearSession(): void {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* No session remains in memory. */ }
}

export function requireSession(): Session {
  const session = getSession();
  if (session) return session;
  expireSession();
  throw new Error('Votre session a expiré. Reconnectez-vous.');
}

export function expireSession(): void {
  clearSession();
  try { sessionStorage.setItem('studio-return-hash', location.hash); } catch {}
  location.replace('/login/');
}

export function returnToStudio(): void {
  let hash = '';
  try { hash = sessionStorage.getItem('studio-return-hash') || ''; sessionStorage.removeItem('studio-return-hash'); } catch {}
  location.replace('/' + (/^#(?:galeries|photos|a-completer|gallery\/[a-f0-9-]{36})$/.test(hash) ? hash : '#galeries'));
}
