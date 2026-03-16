import { sql } from './db.js';

async function ensureTable() {
  await sql`DROP TABLE IF EXISTS requests`;
  await sql`
    CREATE TABLE IF NOT EXISTS requests (
      id         TEXT PRIMARY KEY,
      event_id   TEXT,
      song_title TEXT,
      artist     TEXT,
      user_name  TEXT,
      user_id    TEXT,
      status     TEXT DEFAULT 'pending',
      timestamp  TEXT,
      played_at  TEXT,
      user_agent TEXT
    )
  `;
}

let tableReady = false;
async function initTable() {
  if (tableReady) return;
  await ensureTable();
  tableReady = true;
}

function toRow(row) {
  if (!row) return null;
  return {
    id:        row.id,
    eventId:   row.event_id,
    songTitle: row.song_title,
    artist:    row.artist,
    userName:  row.user_name,
    userId:    row.user_id,
    status:    row.status,
    timestamp: row.timestamp,
    playedAt:  row.played_at,
    userAgent: row.user_agent
  };
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch(e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    await initTable();

    const parts     = req.url.split('?')[0].split('/').filter(Boolean);
    const last      = parts[parts.length - 1];
    const requestId = (last !== 'requests' && last !== '[id]') ? last : null;

    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM requests ORDER BY timestamp DESC`;
      return res.status(200).json({ success: true, data: rows.map(toRow) });
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      const id   = crypto.randomUUID();
      const now  = new Date().toISOString();
      const [row] = await sql`
        INSERT INTO requests
          (id, event_id, song_title, artist, user_name, user_id, status, timestamp, user_agent)
        VALUES
          (${id}, ${body.eventId}, ${body.songTitle}, ${body.artist},
           ${body.userName}, ${body.userId}, 'pending',
           ${body.timestamp ?? now}, ${body.userAgent ?? null})
        RETURNING *
      `;
      return res.status(201).json({ success: true, data: toRow(row) });
    }

    if (req.method === 'PUT' && requestId) {
      const body = await parseBody(req);
      const [row] = await sql`
        UPDATE requests SET
          status    = COALESCE(${body.status   ?? null}, status),
          played_at = COALESCE(${body.playedAt ?? null}, played_at)
        WHERE id = ${requestId}
        RETURNING *
      `;
      if (!row) return res.status(404).json({ success: false, error: 'Request not found' });
      return res.status(200).json({ success: true, data: toRow(row) });
    }

    if (req.method === 'DELETE' && requestId) {
      await sql`DELETE FROM requests WHERE id = ${requestId}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, error: 'Méthode non supportée' });

  } catch (err) {
    console.error('Requests error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
