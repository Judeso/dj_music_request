import { sql } from './db.js';

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS dj_accounts (
      id           TEXT PRIMARY KEY,
      username     TEXT UNIQUE NOT NULL,
      password     TEXT NOT NULL,
      display_name TEXT,
      status       TEXT DEFAULT 'active',
      created_at   TEXT
    )
  `;
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM dj_accounts`;
  if (count === 0) {
    await sql`
      INSERT INTO dj_accounts (id, username, password, display_name, status, created_at)
      VALUES (${crypto.randomUUID()}, 'dj_admin', 'EventManager2024!', 'DJ Admin', 'active', ${new Date().toISOString()})
    `;
  }
}

let ready = false;
async function init() { if (ready) return; await ensureTable(); ready = true; }

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    await init();
    const url = new URL(req.url, 'http://localhost');
    const action = url.searchParams.get('action');
    const parts = url.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    const accountId = (last !== 'accounts' && last !== '[id]') ? last : null;

    // — Login Super Admin (public) —
    if (req.method === 'POST' && action === 'admin-login') {
      const body = await parseBody(req);
      const expectedKey = process.env.SUPER_ADMIN_KEY || 'SuperAdmin2024!';
      if (body.username === 'superadmin' && body.password === expectedKey) {
        return res.status(200).json({ success: true, data: { role: 'admin' } });
      }
      return res.status(401).json({ success: false, error: 'Identifiants invalides' });
    }

    // — Login DJ (public) —
    if (req.method === 'POST' && action === 'login') {
      const body = await parseBody(req);
      const rows = await sql`SELECT * FROM dj_accounts WHERE username = ${body.username} AND status = 'active'`;
      const account = rows[0];
      if (account && account.password === body.password) {
        return res.status(200).json({ success: true, data: { id: account.id, username: account.username, displayName: account.display_name } });
      }
      return res.status(401).json({ success: false, error: 'Identifiants invalides' });
    }

    // — Toutes les opérations suivantes nécessitent la clé admin —
    const adminKey = req.headers['x-admin-key'];
    const expectedKey = process.env.SUPER_ADMIN_KEY || 'SuperAdmin2024!';
    if (adminKey !== expectedKey) {
      return res.status(403).json({ success: false, error: 'Non autorisé' });
    }

    if (req.method === 'GET') {
      const rows = await sql`SELECT id, username, display_name, status, created_at FROM dj_accounts ORDER BY created_at`;
      return res.status(200).json({ success: true, data: rows });
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.username || !body.password) return res.status(400).json({ success: false, error: 'username et password requis' });
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const [row] = await sql`
        INSERT INTO dj_accounts (id, username, password, display_name, status, created_at)
        VALUES (${id}, ${body.username}, ${body.password}, ${body.displayName || body.username}, ${body.status || 'active'}, ${now})
        RETURNING id, username, display_name, status, created_at
      `;
      return res.status(201).json({ success: true, data: row });
    }

    if (req.method === 'PUT' && accountId) {
      const body = await parseBody(req);
      const [row] = await sql`
        UPDATE dj_accounts SET
          username     = COALESCE(${body.username    || null}, username),
          password     = COALESCE(${body.password    || null}, password),
          display_name = COALESCE(${body.displayName || null}, display_name),
          status       = COALESCE(${body.status      || null}, status)
        WHERE id = ${accountId}
        RETURNING id, username, display_name, status, created_at
      `;
      if (!row) return res.status(404).json({ success: false, error: 'Compte introuvable' });
      return res.status(200).json({ success: true, data: row });
    }

    if (req.method === 'DELETE' && accountId) {
      await sql`DELETE FROM dj_accounts WHERE id = ${accountId}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, error: 'Méthode non supportée' });

  } catch (err) {
    console.error('Accounts error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
