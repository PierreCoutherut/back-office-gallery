import { normalizePhoto, type Photo } from '../lib/data';
import { JsonArrayStream } from '../lib/json-array-stream';

self.onmessage = async (event: MessageEvent<{ accessToken: string }>) => {
  let batch: Photo[] = [];
  const flush = () => { if (batch.length) { self.postMessage({ type: 'batch', photos: batch }); batch = []; } };
  try {
    const response = await fetch('https://api.pierre-coutherut.fr/photos', {
      headers: { Authorization: 'Bearer ' + event.data.accessToken },
      credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(120000),
    });
    if (response.status === 401) { self.postMessage({ type: 'auth' }); return; }
    if (!response.ok || !response.body) throw new Error(`Chargement impossible (${response.status}).`);
    const parser = new JsonArrayStream(value => { batch.push(normalizePhoto(value)); if (batch.length >= 250) flush(); });
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let last = Date.now();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
        if (Date.now() - last > 200) { flush(); last = Date.now(); }
      }
      parser.push(decoder.decode()); parser.finish(); flush();
      self.postMessage({ type: 'done' });
    } finally { await reader.cancel(); }
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Le chargement a été interrompu.' });
  }
};
