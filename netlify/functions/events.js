// netlify/functions/events.js
import { sql } from './db.js';

export default async (request, context) => {
  try {
    if (request.method === "GET") {
      // Récupère tous les events
      const rows = await sql`SELECT * FROM events ORDER BY date DESC`;
      return new Response(JSON.stringify({ success: true, data: rows }), { status: 200 });
    }

    if (request.method === "POST") {
      const body = await request.json();
      const [newEvent] = await sql`
        INSERT INTO events (id, name, date)
        VALUES (${crypto.randomUUID()}, ${body.name}, ${body.date})
        RETURNING *;
      `;
      return new Response(JSON.stringify({ success: true, data: newEvent }), { status: 201 });
    }

    return new Response(JSON.stringify({ success: false, error: "Méthode non supportée" }), { status: 405 });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
};
