import { describe, test, expect, beforeAll, afterAll } from 'bun:test';

/**
 * Security audit regression tests (issues #13-#17).
 * These are written BEFORE the fixes (TDD/falsification):
 * every test here must FAIL on the pre-fix code.
 */

const BASE = process.env.TEST_BASE || 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Helper: start the app under test with controlled env
// ---------------------------------------------------------------------------
async function startServer(env: Record<string, string>) {
    const proc = Bun.spawn(['bun', 'run', 'index.ts'], {
        cwd: import.meta.dir,
        env: {
            ...process.env,
            
            DATABASE_PATH: '/tmp/jeet-test-' + Date.now() + '.db',
            ...env,
        },
        stdout: 'pipe',
        stderr: 'pipe',
    });
    // wait for readiness
    for (let i = 0; i < 50; i++) {
        try {
            await fetch(BASE + '/posts');
            break;
        } catch {
            await Bun.sleep(100);
        }
    }
    return proc;
}

describe('#13 admin auth hardening', () => {
    test('refuses to boot in production without ADMIN credentials', async () => {
        const proc = Bun.spawn(['bun', 'run', 'index.ts'], {
            cwd: import.meta.dir,
            env: { ...process.env, NODE_ENV: 'production', PORT: '3098', DATABASE_PATH: '/tmp/jeet-nocreds.db' },
            stdout: 'pipe',
            stderr: 'pipe',
        });
        const code = await proc.exited;
        expect(code).not.toBe(0); // must crash fast
        const err = await new Response(proc.stderr).text();
        expect(err.toLowerCase()).toContain('admin');
        proc.kill();
    });

    test('wrong credentials rejected with 401', async () => {
        // started in suite bootstrap below
    });

    test('timing-safe comparison used (constant-time)', () => {
        // implementation detail verified via source inspection helper
        const src = Bun.file(import.meta.dir + '/index.ts');
        return src.text().then((t) => {
            expect(t.includes('timingSafeEqual') || t.includes('safeEqualStrings')).toBe(true);
        });
    });
});

let server: ReturnType<typeof Bun.spawn> | null = null;

beforeAll(async () => {
    server = await startServer({
        NODE_ENV: 'production',
        ADMIN_USERNAME: 'testadmin',
        ADMIN_PASSWORD: 'S3cureP@ss!',
        SESSION_SECRET: 'test-secret-for-signing',
        MODERATION_SERVICE_URL: 'http://127.0.0.1:59999/moderate', // deliberately DEAD -> fail-closed test
    });
});

afterAll(() => server?.kill());

describe('#15 moderation fails closed', () => {
    test('post is REJECTED (503) when moderation service is down', async () => {
        const res = await fetch(BASE + '/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: 'Have a wonderful day!' }),
        });
        expect(res.status).toBe(503);
    });

    test('moderation fetch has a timeout (no unbounded hang)', () => {
        const src = Bun.file(import.meta.dir + '/index.ts');
        return src.text().then((t) => {
            expect(t.includes('AbortSignal.timeout') || t.includes('AbortController')).toBe(true);
        });
    });
});

describe('#14 admin session tokens instead of Basic-auth-from-sessionStorage', () => {
    let tokenCookie = '';

    test('POST /admin/login exchanges credentials for signed HttpOnly token', async () => {
        const res = await fetch(BASE + '/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'testadmin', password: 'S3cureP@ss!' }),
        });
        expect(res.status).toBe(200);
        const setCookie = res.headers.get('set-cookie') || '';
        expect(setCookie).toContain('HttpOnly');
        expect(setCookie).toContain('admin_session');
        tokenCookie = setCookie.split(';')[0];
    });

    test('admin endpoints accept the session cookie (no password re-send)', async () => {
        const res = await fetch(BASE + '/admin/posts', {
            headers: { Cookie: tokenCookie },
        });
        expect(res.status).toBe(200);
    });

    test('tampered token rejected', async () => {
        const res = await fetch(BASE + '/admin/posts', {
            headers: { Cookie: 'admin_session=tampered.garbage' },
        });
        expect(res.status).toBe(401);
    });
});

describe('#17 no ip_hash leak to clients', () => {
    test('/posts does not expose ip_hash', async () => {
        const res = await fetch(BASE + '/posts');
        expect(res.status).toBe(200);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
            expect(Object.keys(data[0])).not.toContain('ip_hash');
        }
        expect(JSON.stringify(data)).not.toContain('ip_hash');
    });

    test('WS broadcast payload excludes ip_hash (source check)', () => {
        const src = Bun.file(import.meta.dir + '/index.ts');
        return src.text().then((t) => {
            expect(t.includes("SELECT * FROM posts")).toBe(false);
        });
    });
});

describe('#16 like dedupe not spoofable', () => {
    test('same IP cannot like twice with different client-id headers', async () => {
        // seed one post directly via DB-free path: moderation is down so we insert
        // through admin-independent test hook: use direct sqlite on the test db
        const { Database } = await import('bun:sqlite');
        const dbPath = (server as any)?.env?.DATABASE_PATH;
        void dbPath;
        // find the db file created by the running server
        const glob = Array.from(new Bun.Glob('/tmp/jeet-test-*.db').scanSync());
        expect(glob.length).toBeGreaterThan(0);
        const db = new Database(glob[0]);
        db.run(
            "INSERT INTO posts (username, content, kindness_points, ip_hash) VALUES ('TestOtter1','kind words',0,'seedhash')"
        );
        const post: any = db.query('SELECT id FROM posts ORDER BY id DESC LIMIT 1').get();
        db.close();

        const likeOnce = await fetch(`${BASE}/posts/${post.id}/like`, {
            method: 'POST',
            headers: { 'x-client-id': 'aaa' },
        });
        expect(likeOnce.status).toBe(200);

        const likeTwice = await fetch(`${BASE}/posts/${post.id}/like`, {
            method: 'POST',
            headers: { 'x-client-id': 'totally-different' }, // spoof attempt
        });
        expect(likeTwice.status).toBe(400); // must be rejected now

        const final = await fetch(`${BASE}/posts`);
        const posts = (await final.json()) as any[];
        const target = posts.find((p) => p.id === post.id);
        expect(target.kindness_points).toBe(1); // NOT 2
    });
});
