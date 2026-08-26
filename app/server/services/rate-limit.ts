import { Context, Next } from 'hono';
import db from '../db/schema';
import { timingSafeEqual } from './auth';

export async function checkRateLimit(ipHash: string, actionType: 'post' | 'like') {
    const now = new Date().toISOString();

    // Clean up expired rate limits
    db.run('DELETE FROM rate_limits WHERE expires_at < ?', [now]);

    // Count active rate limits for this IP and action
    const result = db.query('SELECT COUNT(*) as count FROM rate_limits WHERE ip_hash = ? AND action_type = ? AND expires_at > ?')
        .get(ipHash, actionType, now) as { count: number };

    const limits = {
        post: 10,
        like: 50
    };

    const windowMs = 3600000; // 1 hour

    if (result.count >= limits[actionType]) {
        return { allowed: false, retryAfter: '1 hour' };
    }

    // Record this action
    const expiresAt = new Date(Date.now() + windowMs).toISOString();
    db.run('INSERT INTO rate_limits (ip_hash, action_type, expires_at) VALUES (?, ?, ?)', [ipHash, actionType, expiresAt]);

    return { allowed: true };
}

/**
 * Salted HMAC-SHA256 IP hash (#17/#18).
 * Unsalted SHA-256 over IPv4 is trivially reversible by enumeration.
 * Uses SESSION_SECRET (previously documented but unused — #20).
 */
export async function hashIP(ip: string): Promise<string> {
    const secret = process.env.SESSION_SECRET || 'jeetsocial-dev-ip-salt';
    return hashWithSecret(ip, secret);
}

function hashWithSecret(value: string, secret: string): Promise<string> {
    const enc = new TextEncoder();
    const keyPromise = crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    return keyPromise.then((key) =>
        crypto.subtle.sign('HMAC', key, enc.encode(value))
    ).then((sig) => {
        const bytes = new Uint8Array(sig);
        let hex = '';
        for (const b of bytes) hex += b.toString(16).padStart(2, '0');
        return hex;
    });
}

export { hashWithSecret, timingSafeEqual };
