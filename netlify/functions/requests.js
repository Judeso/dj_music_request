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
      return new Response(JSON.stringify({ success: true, data: rows }), { 
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
      return new Response(JSON.stringify({ success: true, data: newRequest }), { 
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

      const [updatedRequest] = await sql`
        UPDATE requests 
        SET status = ${body.status || 'pending'}
        WHERE id = ${requestId}
        RETURNING *;
      `;
      
      return new Response(JSON.stringify({ success: true, data: updatedRequest }), { 
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
