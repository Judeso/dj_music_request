// netlify/functions/events.js
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

    if (request.method === "PUT") {
      const body = await request.json();
      const url = new URL(request.url);
      const eventId = url.pathname.split('/').pop();

      if (!eventId) {
        return new Response(JSON.stringify({ success: false, error: "ID d'événement manquant" }), { status: 400, headers });
      }

      // Construire dynamiquement les champs à mettre à jour selon les colonnes probables
      // Nous mettons à jour prudemment: name, date, status, location, expected_guests, description, updated_at, short_code
      const fields = [];
      const values = [];

      if (body.name != null) { fields.push(sql`name = ${body.name}`); }
      if (body.date != null) { fields.push(sql`date = ${body.date}`); }
      if (body.status != null) { fields.push(sql`status = ${body.status}`); }
      if (body.location != null) { fields.push(sql`location = ${body.location}`); }
      if (body.expectedGuests != null) { fields.push(sql`expected_guests = ${body.expectedGuests}`); }
      if (body.description != null) { fields.push(sql`description = ${body.description}`); }
      if (body.shortCode != null) { fields.push(sql`short_code = ${body.shortCode}`); }
      // Toujours mettre à jour updated_at si possible
      fields.push(sql`updated_at = ${body.updatedAt || new Date().toISOString()}`);

      if (fields.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'Aucune donnée à mettre à jour' }), { status: 400, headers });
      }

      const [updated] = await sql`
        UPDATE events
        SET ${sql.join(fields, sql`, `)}
        WHERE id = ${eventId}
        RETURNING *;
      `;

      return new Response(JSON.stringify({ success: true, data: updated }), { status: 200, headers });
    }

    if (request.method === "DELETE") {
      const url = new URL(request.url);
      const eventId = url.pathname.split('/').pop();

      if (!eventId) {
        return new Response(JSON.stringify({ success: false, error: "ID d'événement manquant" }), { status: 400, headers });
      }

      // Supprimer d'abord les demandes liées (si pas de cascade en base)
      try {
        await sql`DELETE FROM requests WHERE event_id = ${eventId}`;
      } catch (e) {
        // Ignorer si la table/contrainte n'existe pas
      }

      const result = await sql`DELETE FROM events WHERE id = ${eventId} RETURNING id`;
      if (result.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'Événement introuvable' }), { status: 404, headers });
      }

      return new Response(JSON.stringify({ success: true, data: { id: eventId } }), { status: 200, headers });
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
