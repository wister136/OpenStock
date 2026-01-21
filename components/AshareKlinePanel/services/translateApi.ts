export async function getTranslateStats() {
  return fetch('/api/translate/stats', { cache: 'no-store' });
}
