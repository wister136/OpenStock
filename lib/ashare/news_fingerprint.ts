import crypto from 'crypto';

export function buildNewsFingerprint(args: {
  url?: string;
  title: string;
  publishedAt: number;
  source: string;
}): string {
  const url = typeof args.url === 'string' ? args.url.trim() : '';
  const basis = url ? url : `${args.title}|${args.publishedAt}|${args.source}`;
  return crypto.createHash('sha1').update(basis).digest('hex');
}
