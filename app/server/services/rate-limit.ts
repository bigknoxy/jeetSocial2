import { Context, Next } from 'hono';
import db from '../db/schema';

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

export async function hashIP(ip: string): Promise<string> {
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(ip);
    return hasher.digest("hex");
}
