import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import type { Server } from 'bun';
import db from './db/schema';
import { migrate } from './db/migrations';
import { generateUsername } from './services/username';
import { checkRateLimit, hashIP } from './services/rate-limit';

// Global state for WebSockets
const clients = new Set<any>();

// Initialize DB
migrate(db);

const app = new Hono();

app.use('*', cors());

// API Routes
app.get('/posts', (c) => {
    const type = c.req.query('type') || 'recent';
    let posts;

    if (type === 'top') {
        posts = db.query('SELECT * FROM posts ORDER BY kindness_points DESC, created_at DESC LIMIT 50').all();
    } else {
        posts = db.query('SELECT * FROM posts ORDER BY created_at DESC LIMIT 50').all();
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

    // Moderation
    try {
        const modUrl = process.env.MODERATION_SERVICE_URL || 'http://localhost:3001';
        const modResponse = await fetch(`${modUrl}/moderate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: content })
        });
        const modResult = await modResponse.json() as { allowed: boolean; reason?: string };

        if (!modResult.allowed) {
            return c.json({ error: modResult.reason || 'Content rejected by moderation' }, 403);
        }
    } catch (e) {
        console.error('Moderation service error:', e);
        // Fail closed if moderation service is down (optional, but safer for "kindness" focus)
        // return c.json({ error: 'Moderation service unavailable' }, 503);
    }

    const username = generateUsername();
    const stmt = db.prepare('INSERT INTO posts (username, content, ip_hash) VALUES (?, ?, ?)');
    const result = stmt.run(username, content, ipHash);

    const newPost = db.query('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid) as any;

    // Broadcast to all clients
    broadcast({ type: 'NEW_POST', post: newPost });

    return c.json(newPost);
});

app.post('/posts/:id/like', async (c) => {
    const id = c.req.param('id');
    const clientIdentifier = c.req.header('x-client-id') || 'anonymous';
    const ip = c.req.header('x-forwarded-for') || '127.0.0.1';
    const ipHash = await hashIP(ip);

    // Rate limiting
    const rateLimit = await checkRateLimit(ipHash, 'like');
    if (!rateLimit.allowed) {
        return c.json({ error: `Rate limit exceeded. Try again in ${rateLimit.retryAfter}.` }, 429);
    }

    try {
        db.run('INSERT INTO likes (post_id, client_identifier) VALUES (?, ?)', [id, clientIdentifier]);
        db.run('UPDATE posts SET kindness_points = kindness_points + 1 WHERE id = ?', [id]);

        const updatedPost = db.query('SELECT * FROM posts WHERE id = ?').get(id) as any;
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

const server = Bun.serve({
    port: 3000,
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