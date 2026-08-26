/**
 * Auth utilities (#13, #14):
 *  - constant-time string comparison
 *  - signed, expiring session tokens (HMAC-SHA256) for the admin session cookie
 */
import { hashWithSecret } from './rate-limit';

export function timingSafeEqual(a: Uint8Array | undefined, b: Uint8Array | undefined): boolean {
    if (!a || !b || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
    return diff === 0;
}

export function safeEqualStrings(a: string, b: string): boolean {
    const enc = new TextEncoder();
    return timingSafeEqual(enc.encode(a), enc.encode(b));
}

function hmacHex(payload: string, secret: string): string {
    const hasher = new Bun.CryptoHasher('sha256', secret);
    hasher.update(payload);
    return hasher.digest('hex');
}

function getSecret(): string {
    return process.env.SESSION_SECRET || 'jeetsocial-dev-session-secret';
}

/**
 * Token format: base64url(payload).hex(hmac)
 * payload = JSON { exp } — expiry as unix ms.
 */
export function signToken(maxAgeSeconds: number): string {
    const payload = Buffer.from(
        JSON.stringify({ exp: Date.now() + maxAgeSeconds * 1000 })
    ).toString('base64url');
    void hashWithSecret; // async variant available in rate-limit for other uses
    return `${payload}.${hmacHex(payload, getSecret())}`;
}

export function verifyToken(token: string): boolean {
    const dot = token.lastIndexOf('.');
    if (dot < 0) return false;
    const payloadB64 = token.slice(0, dot);
    const sig = token.slice(dot + 1);

    if (!safeEqualStrings(sig, hmacHex(payloadB64, getSecret()))) return false;

    try {
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
        if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return false;
        return true;
    } catch {
        return false;
    }
}
