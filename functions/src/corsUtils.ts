const DEFAULT_ALLOWED_ORIGINS = [
  'https://js-connect.fr',
  'https://www.js-connect.fr',
  'http://localhost:3006',
  'http://localhost:3011',
  'http://localhost:5173',
];

export function getAllowedOrigin(requestOrigin: string | undefined): string | null {
  const extra = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = [...DEFAULT_ALLOWED_ORIGINS, ...extra];
  if (!requestOrigin) return allowed[0] ?? null;
  if (allowed.includes(requestOrigin)) return requestOrigin;
  // Dev local : autoriser tout port localhost (ex. vite sur :3006)
  if (/^http:\/\/localhost:\d+$/.test(requestOrigin)) return requestOrigin;
  if (/^http:\/\/127\.0\.0\.1:\d+$/.test(requestOrigin)) return requestOrigin;
  return null;
}

export function setRestrictedCorsHeaders(res: { set: (k: string, v: string) => void }, origin: string | undefined): boolean {
  const allowed = getAllowedOrigin(origin);
  if (origin && !allowed) {
    return false;
  }
  res.set('Access-Control-Allow-Origin', allowed || DEFAULT_ALLOWED_ORIGINS[0]);
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');
  return true;
}
