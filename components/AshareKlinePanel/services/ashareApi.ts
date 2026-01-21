export async function getConfig(symbol: string) {
  return fetch(`/api/ashare/config?symbol=${encodeURIComponent(symbol)}`, { cache: 'no-store' });
}

export async function postConfig(symbol: string, payload: { weights: any; thresholds: any; positionCaps: any }) {
  return fetch('/api/ashare/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      symbol,
      weights: payload.weights,
      thresholds: payload.thresholds,
      positionCaps: payload.positionCaps,
    }),
  });
}

export async function getAutoTuneLatest(symbol: string, tf: string) {
  return fetch(`/api/ashare/autotune?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}`, { cache: 'no-store' });
}

export async function postAutoTuneStart(symbol: string, tf: string, trainDays: number, trials: number) {
  return fetch('/api/ashare/autotune', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, tf, trainDays, trials }),
  });
}

export async function getEventsFeed(symbol: string, limit: number) {
  return fetch(`/api/ashare/events/feed?symbol=${encodeURIComponent(symbol)}&limit=${limit}`, { cache: 'no-store' });
}
