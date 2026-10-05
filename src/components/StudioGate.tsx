import { lazy, Suspense, useEffect, useState } from 'react';
import { getSession, expireSession } from '../lib/session';
const Studio = lazy(() => import('./Studio'));

export default function StudioGate() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const session = getSession();
    if (!session) { expireSession(); return; }
    setReady(true);
    const timer = setTimeout(expireSession, Math.max(0, session.expiresAt - Date.now()));
    const check = () => { if (!getSession()) expireSession(); };
    document.addEventListener('visibilitychange', check);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', check); };
  }, []);
  const loading = <main className="studio-loading" role="status">Ouverture du studio…</main>;
  return ready ? <Suspense fallback={loading}><Studio /></Suspense> : loading;
}
