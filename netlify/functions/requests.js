// netlify/functions/requests.js
import { sql } from './db.js';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

export default async (request, context) => {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  try {
    // Helper: map DB row (snake_case) to API response (camelCase)
    const toCamel = (row) => row && ({
      id: row.id,
      eventId: row.event_id,
      songTitle: row.song_title,
      artist: row.artist,
      userName: row.user_name,
      userId: row.user_id,
      status: row.status,
      timestamp: row.timestamp,
      playedAt: row.played_at
    });

    if (request.method === "GET") {
      const url = new URL(request.url);
      const eventId = url.searchParams.get('eventId');
      
      let query;
      if (eventId) {
        query = sql`SELECT * FROM requests WHERE event_id = ${eventId} ORDER BY timestamp DESC`;
      } else {
        query = sql`SELECT * FROM requests ORDER BY timestamp DESC`;
      }
      
      const rows = await query;
      return new Response(JSON.stringify({ success: true, data: rows.map(toCamel) }), { 
        status: 200, 
        headers 
      });
    }

    if (request.method === "POST") {
      const body = await request.json();
      
      // Helper: validate UUID v4 format
      const isUUID = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
      
      // Validation des données
      if (!body.songTitle || !body.artist || !body.userName) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Titre, artiste et nom d'utilisateur requis" 
        }), { status: 400, headers });
      }

      // user_id doit être un UUID en base; si le client envoie un identifiant custom, on génère un UUID côté serveur
      const safeUserId = isUUID(body.userId) ? body.userId : crypto.randomUUID();

      const [newRequest] = await sql`
        INSERT INTO requests (id, event_id, song_title, artist, user_name, user_id, status, timestamp)
        VALUES (
          ${crypto.randomUUID()},
          ${body.eventId || null},
          ${body.songTitle},
          ${body.artist},
          ${body.userName},
          ${safeUserId},
          'pending',
          ${new Date().toISOString()}
        )
        RETURNING *;
      `;
      return new Response(JSON.stringify({ success: true, data: toCamel(newRequest) }), { 
        status: 201, 
        headers 
      });
    }

    if (request.method === "PUT") {
      const body = await request.json();
      const url = new URL(request.url);
      const requestId = url.searchParams.get('id');
      
      if (!requestId) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "ID de requête manquant" 
        }), { status: 400, headers });
      }

      // Support updating status and optionally played_at
      const statusVal = (body.status ?? null);
      const playedAtVal = (body.playedAt ?? null);

      const [updatedRequest] = await sql`
        UPDATE requests 
        SET 
          status = COALESCE(${statusVal}, status),
          played_at = COALESCE(${playedAtVal}, played_at)
        WHERE id = ${requestId}
        RETURNING *;
      `;
      
      return new Response(JSON.stringify({ success: true, data: toCamel(updatedRequest) }), { 
        status: 200, 
        headers 
      });
    }

    if (request.method === "DELETE") {
      const url = new URL(request.url);
      const requestId = url.searchParams.get('id');

      if (!requestId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'ID de requête manquant'
        }), { status: 400, headers });
      }

      await sql`DELETE FROM requests WHERE id = ${requestId}`;
      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: "Méthode non supportée" 
    }), { status: 405, headers });

  } catch (err) {
    console.error('Requests API Error:', err);
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message 
    }), { status: 500, headers });
  }
};
