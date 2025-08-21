// netlify/functions/requests.js
import { sql } from './db.js';

export default async (request, context) => {
  try {
    if (request.method === "GET") {
      // Récupère toutes les requêtes de chansons
      const rows = await sql`SELECT * FROM requests ORDER BY timestamp DESC`;
      return new Response(JSON.stringify({ success: true, data: rows }), { status: 200 });
    }

    if (request.method === "POST") {
      const body = await request.json();
      const [newRequest] = await sql`
        INSERT INTO requests (id, event_id, song_title, artist, user_name, user_id, status, timestamp)
        VALUES (
          ${crypto.randomUUID()},
          ${body.eventId},
          ${body.songTitle},
          ${body.artist},
          ${body.userName},
          ${body.userId},
          'pending',
          ${new Date().toISOString()}
        )
        RETURNING *;
      `;
      return new Response(JSON.stringify({ success: true, data: newRequest }), { status: 201 });
    }

    return new Response(JSON.stringify({ success: false, error: "Méthode non supportée" }), { status: 405 });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
};
