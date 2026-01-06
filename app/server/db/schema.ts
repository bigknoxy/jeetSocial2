import { Database } from 'bun:sqlite';

const dbPath = process.env.DATABASE_PATH || 'social.db';
const db = new Database(dbPath);

export interface Post {
    id: number;
    username: string;
    content: string;
    kindness_points: number;
    created_at: string;
    ip_hash: string;
}

export interface Like {
    id: number;
    post_id: number;
    client_identifier: string;
    created_at: string;
}

export interface RateLimit {
    id: number;
    ip_hash: string;
    action_type: 'post' | 'like';
    created_at: string;
    expires_at: string;
}

export default db;
