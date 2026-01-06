import { Database } from 'bun:sqlite';

export function migrate(db: Database) {
    db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      content TEXT NOT NULL,
      kindness_points INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ip_hash TEXT NOT NULL
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      client_identifier TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      UNIQUE(post_id, client_identifier)
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_hash TEXT NOT NULL,
      action_type TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL
    )
  `);

    // Indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_posts_kindness_points ON posts(kindness_points)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_likes_post_client ON likes(post_id, client_identifier)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_rate_limit_ip_expires ON rate_limits(ip_hash, expires_at)`);
}
