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
      const map = (r) => ({
        id: r.id,
        name: r.name,
        date: r.date,
        status: r.status || 'preparation',
        location: r.location || null,
        expectedGuests: r.expected_guests ?? null,
        description: r.description || null,
        shortCode: r.short_code || null,
        createdAt: r.created_at || null,
        updatedAt: r.updated_at || null,
      });
      const data = rows.map(map);
      return new Response(JSON.stringify({ success: true, data }), { 
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

      const id = crypto.randomUUID();
      const nowIso = new Date().toISOString();
      const status = body.status || 'preparation';
      const location = body.location ?? null;
      const expectedGuests = body.expectedGuests ?? null;
      const description = body.description ?? null;
      const shortCode = body.shortCode ?? null;

      const [inserted] = await sql`
        INSERT INTO events (
          id, name, date, status, location, expected_guests, description, short_code, created_at, updated_at
        ) VALUES (
          ${id}, ${body.name}, ${body.date}, ${status}, ${location}, ${expectedGuests}, ${description}, ${shortCode}, ${nowIso}, ${nowIso}
        )
        RETURNING *;
      `;

      const mapped = {
        id: inserted.id,
        name: inserted.name,
        date: inserted.date,
        status: inserted.status,
        location: inserted.location || null,
        expectedGuests: inserted.expected_guests ?? null,
        description: inserted.description || null,
        shortCode: inserted.short_code || null,
        createdAt: inserted.created_at || nowIso,
        updatedAt: inserted.updated_at || nowIso,
      };

      return new Response(JSON.stringify({ success: true, data: mapped }), { 
        status: 201, 
        headers 
      });
    }

    if (request.method === "PUT") {
      const body = await request.json();
      const url = new URL(request.url);
      // Support both query param (?id=...) and path segment (/events/:id)
      const eventId = url.searchParams.get('id') || url.pathname.split('/').pop();

      if (!eventId) {
        return new Response(JSON.stringify({ success: false, error: "ID d'événement manquant" }), { status: 400, headers });
      }

      // Construire dynamiquement les champs à mettre à jour selon les colonnes probables
      // Nous mettons à jour prudemment: name, date, status, location, expected_guests, description, short_code
      const baseFields = [];
      if (body.name != null) { baseFields.push(sql`name = ${body.name}`); }
      if (body.date != null) { baseFields.push(sql`date = ${body.date}`); }
      if (body.status != null) { baseFields.push(sql`status = ${body.status}`); }
      if (body.location != null) { baseFields.push(sql`location = ${body.location}`); }
      if (body.expectedGuests != null) { baseFields.push(sql`expected_guests = ${body.expectedGuests}`); }
      if (body.description != null) { baseFields.push(sql`description = ${body.description}`); }
      if (body.shortCode != null) { baseFields.push(sql`short_code = ${body.shortCode}`); }

      if (baseFields.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'Aucune donnée à mettre à jour' }), { status: 400, headers });
      }
      
      let updated;
      const updatedAtValue = body.updatedAt || new Date().toISOString();
      try {
        // Tentative 1: avec updated_at
        const fieldsWithUpdated = [...baseFields, sql`updated_at = ${updatedAtValue}`];
        [updated] = await sql`
          UPDATE events
          SET ${sql.join(fieldsWithUpdated, sql`, `)}
          WHERE id = ${eventId}
          RETURNING *;
        `;
      } catch (e) {
        console.warn('PUT events: retrying without updated_at field due to error:', e?.message || e);
        // Tentative 2: sans updated_at (pour schémas ne possédant pas cette colonne)
        [updated] = await sql`
          UPDATE events
          SET ${sql.join(baseFields, sql`, `)}
          WHERE id = ${eventId}
          RETURNING *;
        `;
      }

      if (!updated) {
        return new Response(JSON.stringify({ success: false, error: "Événement introuvable pour mise à jour" }), { status: 404, headers });
      }

      const mapped = {
        id: updated.id,
        name: updated.name,
        date: updated.date,
        status: updated.status || 'preparation',
        location: updated.location || null,
        expectedGuests: updated.expected_guests ?? null,
        description: updated.description || null,
        shortCode: updated.short_code || null,
        createdAt: updated.created_at || null,
        updatedAt: updated.updated_at || null,
      };

      return new Response(JSON.stringify({ success: true, data: mapped }), { status: 200, headers });
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
    console.error('Error stack:', err.stack);
    console.error('Request method:', request.method);
    console.error('Request URL:', request.url);
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message,
      stack: err.stack 
    }), { status: 500, headers });
  }
};
