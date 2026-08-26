import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import type { Server } from 'bun';
import db from './db/schema';
import { migrate } from './db/migrations';
import { generateUsername } from './services/username';
import { checkRateLimit, hashIP } from './services/rate-limit';
import { verifyToken, signToken, safeEqualStrings } from './services/auth';

// Global state for WebSockets
const clients = new Set<any>();

// Initialize DB
migrate(db);

// ---------------------------------------------------------------------------
// #13: Fail fast in production without admin credentials
// ---------------------------------------------------------------------------
const IS_PROD = process.env.NODE_ENV === 'production';
if (IS_PROD && (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD)) {
    console.error('FATAL: ADMIN_USERNAME and ADMIN_PASSWORD must be set in production.');
    process.exit(1);
}
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';

const app = new Hono();

app.use('*', cors());

// Public post columns — never expose ip_hash (#17)
const PUBLIC_POST_COLS = 'id, username, content, kindness_points, created_at';

// API Routes
app.get('/posts', (c) => {
    const type = c.req.query('type') || 'recent';
    let posts;

    if (type === 'top') {
        posts = db.query(`SELECT ${PUBLIC_POST_COLS} FROM posts ORDER BY kindness_points DESC, created_at DESC LIMIT 50`).all();
    } else {
        posts = db.query(`SELECT ${PUBLIC_POST_COLS} FROM posts ORDER BY created_at DESC LIMIT 50`).all();
    }

    return c.json(posts);
});

app.post('/posts', async (c) => {
    const { content } = await c.req.json<{ content: string }>();
    const ip = c.req.header('x-forwarded-for') || '127.0.0.1';
    const ipHash = await hashIP(ip);

    if (!content || content.length > 280) {
        return c.json({ error: 'Invalid content' }, 400);
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(ipHash, 'post');
    if (!rateLimit.allowed) {
        return c.json({ error: `Rate limit exceeded. Try again in ${rateLimit.retryAfter}.` }, 429);
    }

    // Moderation — #15: bounded timeout AND fail closed
    try {
        const modUrl = process.env.MODERATION_SERVICE_URL || 'http://localhost:3001';
        const modResponse = await fetch(`${modUrl}/moderate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: content }),
            signal: AbortSignal.timeout(5000),
        });
        if (!modResponse.ok) {
            return c.json({ error: 'Moderation service unavailable. Please try again shortly.' }, 503);
        }
        const modResult = await modResponse.json() as { allowed: boolean; reason?: string };

        if (!modResult.allowed) {
            return c.json({ error: modResult.reason || 'Let\'s keep it kind! Your message was slightly too negative for our community guidelines.' }, 403);
        }
    } catch (e) {
        console.error('Moderation service error:', e);
        // #15: fail CLOSED — do not insert unmoderated content
        return c.json({ error: 'Moderation service unavailable. Please try again shortly.' }, 503);
    }

    const username = generateUsername();
    const stmt = db.prepare('INSERT INTO posts (username, content, ip_hash) VALUES (?, ?, ?)');
    const result = stmt.run(username, content, ipHash);

    const newPost = db.query(`SELECT ${PUBLIC_POST_COLS} FROM posts WHERE id = ?`).get(result.lastInsertRowid);

    // Broadcast to all clients
    broadcast({ type: 'NEW_POST', post: newPost });

    return c.json(newPost);
});

// ---------------------------------------------------------------------------
// #13 + #14: constant-time credential check + signed session tokens
// ---------------------------------------------------------------------------
// Constant-time Basic credential check (#13)
async function checkAdminCredentials(c: any): Promise<boolean> {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Basic ')) return false;
    try {
        const decoded = atob(authHeader.slice(6));
        const idx = decoded.indexOf(':');
        if (idx < 0) return false;
        return safeEqualStrings(decoded.slice(0, idx), ADMIN_USERNAME)
            && safeEqualStrings(decoded.slice(idx + 1), ADMIN_PASSWORD);
    } catch {
        return false;
    }
}

// #14: accept either a valid signed session cookie or Basic credentials
async function adminAuth(c: any, next: any) {
    const cookieHeader = c.req.header('Cookie') || '';
    const match = cookieHeader.match(/(?:^|;\s*)admin_session=([^;]+)/);
    if (match && verifyToken(match[1])) {
        return await next();
    }
    if (await checkAdminCredentials(c)) {
        return await next();
    }

    console.log(`[AUTH] Failed admin auth attempt from ${c.req.header('x-forwarded-for') || 'unknown'}`);
    return c.json({ error: 'Unauthorized' }, 401);
}

// #14: login endpoint exchanges credentials once for an HttpOnly signed cookie
app.post('/admin/login', async (c) => {
    const body = await c.req.json<{ username?: string; password?: string }>().catch(() => null);
    const user = body?.username ?? '';
    const pass = body?.password ?? '';

    if (!(safeEqualStrings(user, ADMIN_USERNAME) && safeEqualStrings(pass, ADMIN_PASSWORD))) {
        console.log(`[AUTH] Failed admin login attempt from ${c.req.header('x-forwarded-for') || 'unknown'}`);
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const maxAgeSeconds = 8 * 3600; // 8-hour session
    const token = signToken(maxAgeSeconds);
    return c.json(
        { authenticated: true },
        {
            headers: {
                'Set-Cookie': `admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`,
            },
        }
    );
});

app.post('/admin/logout', (c) => {
    return c.json(
        { success: true },
        {
            headers: {
                'Set-Cookie': 'admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
            },
        }
    );
});

app.get('/admin/posts', adminAuth, (c) => {
    const posts = db.query(`SELECT ${PUBLIC_POST_COLS} FROM posts ORDER BY created_at DESC`).all();
    return c.json(posts);
});

app.delete('/admin/posts/:id', adminAuth, (c) => {
    const id = c.req.param('id');

    const post = db.query('SELECT id FROM posts WHERE id = ?').get(id);

    if (!post) {
        return c.json({ error: 'Post not found' }, 404);
    }

    db.run('DELETE FROM posts WHERE id = ?', [id]);

    // Broadcast deletion to all clients
    broadcast({ type: 'DELETE_POST', postId: parseInt(id) });

    return c.json({ success: true, postId: parseInt(id) });
});

app.get('/admin/check-auth', adminAuth, (c) => {
    return c.json({ authenticated: true });
});

// #16: like dedupe keyed on server-derived IP hash — client-id header no longer trusted
app.post('/posts/:id/like', async (c) => {
    const id = c.req.param('id');
    const ip = c.req.header('x-forwarded-for') || '127.0.0.1';
    const ipHash = await hashIP(ip);

    // Rate limiting
    const rateLimit = await checkRateLimit(ipHash, 'like');
    if (!rateLimit.allowed) {
        return c.json({ error: `Rate limit exceeded. Try again in ${rateLimit.retryAfter}.` }, 429);
    }

    try {
        db.run('INSERT INTO likes (post_id, client_identifier) VALUES (?, ?)', [id, ipHash]);
        db.run('UPDATE posts SET kindness_points = kindness_points + 1 WHERE id = ?', [id]);

        const updatedPost = db.query(`SELECT ${PUBLIC_POST_COLS} FROM posts WHERE id = ?`).get(id);
        broadcast({ type: 'UPDATE_POST', post: updatedPost });

        return c.json(updatedPost);
    } catch (e) {
        return c.json({ error: 'Already liked or invalid post' }, 400);
    }
});

// Serve static files from the 'dist' directory (catch all files first)
app.use('*', serveStatic({ root: './dist' }));

// Fallback all other routes to index.html for SPA
app.get('/*', async (c) => {
    const file = Bun.file('./dist/index.html');
    if (await file.exists()) {
        return c.html(await file.text());
    }
    return c.text('Frontend not found. Please build the client.', 404);
});

function broadcast(data: any) {
    const message = JSON.stringify(data);
    for (const client of clients) {
        client.send(message);
    }
}

const PORT = parseInt(process.env.PORT || '3000', 10);

const server = Bun.serve({
    port: PORT,
    hostname: '0.0.0.0',
    fetch: (req, server) => {
        if (server.upgrade(req)) {
            return;
        }
        return app.fetch(req);
    },
    websocket: {
        open(ws) {
            clients.add(ws);
        },
        message(ws, message) {
            // Handle incoming WS messages if needed
        },
        close(ws) {
            clients.delete(ws);
        },
    },
});

console.log(`Main server running on http://localhost:${server.port}`);
console.log(`WS server running on ws://localhost:${server.port}`);
