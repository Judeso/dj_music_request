// netlify/functions/events.js
import { sql } from './db.js';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

export default async (request, context) => {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  try {
    if (request.method === "GET") {
      // Récupère tous les events
      const rows = await sql`SELECT * FROM events ORDER BY date DESC`;
      return new Response(JSON.stringify({ success: true, data: rows }), { 
        status: 200, 
        headers 
      });
    }

    if (request.method === "POST") {
      const body = await request.json();
      
      // Validation des données
      if (!body.name || !body.date) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Nom et date de l'événement requis" 
        }), { status: 400, headers });
      }

      const [newEvent] = await sql`
        INSERT INTO events (id, name, date)
        VALUES (${crypto.randomUUID()}, ${body.name}, ${body.date})
        RETURNING *;
      `;
      return new Response(JSON.stringify({ success: true, data: newEvent }), { 
        status: 201, 
        headers 
      });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: "Méthode non supportée" 
    }), { status: 405, headers });

  } catch (err) {
    console.error('Events API Error:', err);
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message 
    }), { status: 500, headers });
  }
};
