// netlify/functions/requests.js
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

async function ensureTable() {
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

export default async (request, context) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    await ensureTable();

    const pathname  = new URL(request.url).pathname;
    const segments  = pathname.split('/').filter(Boolean);
    const lastSeg   = segments[segments.length - 1];
    const requestId = lastSeg !== 'requests' ? lastSeg : null;

    // GET — list all requests
    if (request.method === 'GET') {
      const rows = await sql`SELECT * FROM requests ORDER BY timestamp DESC`;
      return new Response(
        JSON.stringify({ success: true, data: rows.map(toRow) }),
        { status: 200, headers: CORS }
      );
    }

    // POST — create request
    if (request.method === 'POST') {
      const body = await request.json();
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
      return new Response(
        JSON.stringify({ success: true, data: toRow(row) }),
        { status: 201, headers: CORS }
      );
    }

    // PUT — update request (e.g. mark as played)
    if (request.method === 'PUT' && requestId) {
      const body = await request.json();

      const [row] = await sql`
        UPDATE requests SET
          status    = COALESCE(${body.status   ?? null}, status),
          played_at = COALESCE(${body.playedAt ?? null}, played_at)
        WHERE id = ${requestId}
        RETURNING *
      `;
      if (!row) {
        return new Response(
          JSON.stringify({ success: false, error: 'Request not found' }),
          { status: 404, headers: CORS }
        );
      }
      return new Response(
        JSON.stringify({ success: true, data: toRow(row) }),
        { status: 200, headers: CORS }
      );
    }

    // DELETE — delete request
    if (request.method === 'DELETE' && requestId) {
      await sql`DELETE FROM requests WHERE id = ${requestId}`;
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
    console.error('Requests function error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: CORS }
    );
  }
};
