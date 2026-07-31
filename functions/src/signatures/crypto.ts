import { createHash, randomBytes } from 'crypto';

function getPepper(): string {
  return (
    (process.env.SIGNATURE_TOKEN_PEPPER || '').trim() ||
    (process.env.ENCRYPTION_KEY || '').trim() ||
    'js-connect-signature-dev-pepper'
  );
}

export function generateRawToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(`${rawToken}:${getPepper()}`).digest('hex');
}

export function sha256Buffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

export function maskIp(ip: string | null | undefined): string {
  if (!ip) return '—';
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.xxx.xxx`;
  }
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return `${parts.slice(0, 2).join(':')}:…`;
  }
  return ip.slice(0, 8) + '…';
}
