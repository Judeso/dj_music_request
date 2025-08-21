// netlify/functions/events.js
import { sql } from './db.js';

export default async (request) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response('', { status: 200, headers });
  }

  try {
    if (request.method === 'GET') {
      const rows = await sql`SELECT * FROM events ORDER BY date DESC`;
      return new Response(JSON.stringify({ success: true, data: rows }), { status: 200, headers });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const [newEvent] = await sql`
        INSERT INTO events (id, name, date, status)
        VALUES (${crypto.randomUUID()}, ${body.name}, ${body.date}, 'active')
        RETURNING *;
      `;
      return new Response(JSON.stringify({ success: true, data: newEvent }), { status: 201, headers });
    }

    return new Response(JSON.stringify({ success: false, error: 'Méthode non supportée' }), { status: 405, headers });

  } catch (err) {
    console.error('Erreur DB:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers });
  }
};
