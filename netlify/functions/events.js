// netlify/functions/events.js
import { sql } from './db.js';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

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

async function ensureTable() {
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

export default async (request, context) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    await ensureTable();

    const pathname = new URL(request.url).pathname;
    const segments = pathname.split('/').filter(Boolean);
    const lastSeg  = segments[segments.length - 1];
    const eventId  = lastSeg !== 'events' ? lastSeg : null;

    // GET — list all events
    if (request.method === 'GET') {
      const rows = await sql`SELECT * FROM events ORDER BY date DESC`;
      return new Response(
        JSON.stringify({ success: true, data: rows.map(toRow) }),
        { status: 200, headers: CORS }
      );
    }

    // POST — create event
    if (request.method === 'POST') {
      const body = await request.json();
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
      return new Response(
        JSON.stringify({ success: true, data: toRow(row) }),
        { status: 201, headers: CORS }
      );
    }

    // PUT — update event
    if (request.method === 'PUT' && eventId) {
      const body = await request.json();
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
      if (!row) {
        return new Response(
          JSON.stringify({ success: false, error: 'Event not found' }),
          { status: 404, headers: CORS }
        );
      }
      return new Response(
        JSON.stringify({ success: true, data: toRow(row) }),
        { status: 200, headers: CORS }
      );
    }

    // DELETE — delete event and its requests
    if (request.method === 'DELETE' && eventId) {
      await sql`DELETE FROM requests WHERE event_id = ${eventId}`;
      await sql`DELETE FROM events    WHERE id       = ${eventId}`;
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: CORS }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Méthode non supportée' }),
      { status: 405, headers: CORS }
    );

  } catch (err) {
    console.error('Events function error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: CORS }
    );
  }
};
