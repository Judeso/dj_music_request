import { sql } from './db.js';

async function ensureTable() {
  // Drop + recreate pour avoir un schéma propre (migration one-shot)
  await sql`DROP TABLE IF EXISTS events CASCADE`;
  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      type            TEXT,
      date            TEXT,
      location        TEXT,
      expected_guests INTEGER,
      description     TEXT,
      status          TEXT DEFAULT 'preparation',
      short_code      TEXT,
      created_at      TEXT,
      updated_at      TEXT
    )
  `;
}

// Flag pour ne faire la migration qu'une fois par cold start
let tableReady = false;
async function initTable() {
  if (tableReady) return;
  await ensureTable();
  tableReady = true;
}

function toRow(row) {
  if (!row) return null;
  return {
    id:             row.id,
    name:           row.name,
    type:           row.type,
    date:           row.date,
    location:       row.location,
    expectedGuests: row.expected_guests,
    description:    row.description,
    status:         row.status,
    shortCode:      row.short_code,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at
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

    const parts   = req.url.split('?')[0].split('/').filter(Boolean);
    const last    = parts[parts.length - 1];
    const eventId = (last !== 'events' && last !== '[id]') ? last : null;

    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM events ORDER BY date DESC`;
      return res.status(200).json({ success: true, data: rows.map(toRow) });
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      const now  = new Date().toISOString();
      const id   = crypto.randomUUID();
      const [row] = await sql`
        INSERT INTO events
          (id, name, type, date, location, expected_guests, description, status, short_code, created_at, updated_at)
        VALUES
          (${id}, ${body.name}, ${body.type ?? null}, ${body.date ?? null},
           ${body.location ?? null}, ${body.expectedGuests ?? null}, ${body.description ?? null},
           ${body.status ?? 'preparation'}, ${body.shortCode ?? null},
           ${body.createdAt ?? now}, ${body.updatedAt ?? now})
        RETURNING *
      `;
      return res.status(201).json({ success: true, data: toRow(row) });
    }

    if (req.method === 'PUT' && eventId) {
      const body = await parseBody(req);
      const now  = new Date().toISOString();
      const [row] = await sql`
        UPDATE events SET
          name            = COALESCE(${body.name            ?? null}, name),
          type            = COALESCE(${body.type            ?? null}, type),
          date            = COALESCE(${body.date            ?? null}, date),
          location        = COALESCE(${body.location        ?? null}, location),
          expected_guests = COALESCE(${body.expectedGuests  ?? null}, expected_guests),
          description     = COALESCE(${body.description     ?? null}, description),
          status          = COALESCE(${body.status          ?? null}, status),
          short_code      = COALESCE(${body.shortCode       ?? null}, short_code),
          updated_at      = ${now}
        WHERE id = ${eventId}
        RETURNING *
      `;
      if (!row) return res.status(404).json({ success: false, error: 'Event not found' });
      return res.status(200).json({ success: true, data: toRow(row) });
    }

    if (req.method === 'DELETE' && eventId) {
      await sql`DELETE FROM requests WHERE event_id = ${eventId}`;
      await sql`DELETE FROM events    WHERE id       = ${eventId}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, error: 'Méthode non supportée' });

  } catch (err) {
    console.error('Events error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
